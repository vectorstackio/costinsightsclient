#!/usr/bin/env python3
"""Preparation artifact. No HTTP requests unless explicitly run with --execute."""
import argparse
import getpass
import fcntl
import warnings
import http.cookiejar
import json
import os
import pathlib
import re
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request

ORIGIN = 'https://aws.develop.thebrilliantclub.org'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def check_route(route, method, read_services, generate_report):
    # Enforced at every HTTP call, not just at the top-level CLI flags.
    if (route, method) in {('/api/login', 'POST'), ('/api/auth', 'POST'), ('/api/auth', 'DELETE'), ('/api/reports', 'GET')}:
        return
    if route in {'/api/costs', '/api/reports/history'} and method == 'GET' and read_services:
        return
    if generate_report and method == 'GET' and (
        re.fullmatch(r'/api/reports/generate\?month=\d{4}-(0[1-9]|1[0-2])', route)
        or re.fullmatch(r'/reports/\d{4}-(0[1-9]|1[0-2])', route)
        or re.fullmatch(r'/api/reports/\d{4}-(0[1-9]|1[0-2])/pdf', route)
    ):
        return
    raise ValueError('This request requires separate service/report approval')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--read-services', action='store_true', help='Allow authenticated cost API reads')
    parser.add_argument('--generate-report', action='store_true', help='Allow reporting AWS/OpenAI/S3 work')
    parser.add_argument('--report-month')
    parser.add_argument('--curl-config', help='Private application-owned credential file for an approved report check')
    args = parser.parse_args()
    if not args.execute:
        print('PREPARATION ONLY: no HTTP requests. Live smoke checks require separate approval and --execute.')
        return
    if os.geteuid() == 0:
        raise ValueError('Smoke tests must run unprivileged')
    if not sys.stdin.isatty():
        raise ValueError('Interactive terminal required; never fall back to echoed passwords')
    warnings.simplefilter('error', getpass.GetPassWarning)
    if args.generate_report and not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', args.report_month or ''):
        raise ValueError('Explicit approved report month required')
    # Do not use environment proxies, redirect credentials, or persist sessions.
    jar = http.cookiejar.CookieJar()
    browser = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(), urllib.request.HTTPCookieProcessor(jar))
    isolated = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(route, expected, method='GET', body=None, headers=None, opener=isolated):
        check_route(route, method, args.read_services, args.generate_report)
        values = {'Origin': ORIGIN, **(headers or {})}
        data = None if body is None else json.dumps(body).encode()
        if data is not None:
            values['Content-Type'] = 'application/json'
        req = urllib.request.Request(ORIGIN + route, data=data, headers=values, method=method)
        try:
            response = opener.open(req, timeout=900 if args.generate_report else 30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            status = response.code
            payload = response.read(2_000_001)
            if status != expected or len(payload) > 2_000_000:
                raise ValueError('Unexpected status or response size')
            return payload, response.headers

    # Without a month this route rejects before services even if auth regresses.
    for route in ['/api/reports']:
        request(route, 401)
    print('PASS: unauthenticated requests rejected')
    email = getpass.getpass('Existing configured login email (not echoed): ')
    password = getpass.getpass('Existing password (not echoed): ')
    raw, _ = request('/api/login', 200, 'POST', {'email': email, 'password': password})
    login = json.loads(raw)
    token = login.get('token')
    if not login.get('success') or not isinstance(token, str) or not token:
        raise ValueError('Login failed')
    password = None
    raw, headers = request('/api/auth', 200, 'POST', {'token': token}, opener=browser)
    if json.loads(raw) != {'success': True}:
        raise ValueError('Unexpected session contract')
    cookie = headers.get('Set-Cookie', '').lower()
    if not all(flag in cookie for flag in ['httponly', 'secure', 'samesite=strict']):
        raise ValueError('Session cookie flags missing')
    print('PASS: existing login and protected session cookie')
    if args.read_services:
        request('/api/costs', 401)
        request('/api/reports/history', 401)
        request('/api/costs', 200, headers={'Authorization': 'Bearer ' + token})
        request('/api/costs', 200, opener=browser)
        print('PASS: authenticated Bearer and cookie cost API reads')
    if args.generate_report:
        if not args.curl_config:
            raise ValueError('Explicit credential file required')
        file = pathlib.Path(args.curl_config)
        info = file.lstat()
        if file.is_symlink() or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o600:
            raise ValueError('Credential file must be application-owned mode 0600')
        match = re.fullmatch(r'header = "Authorization: ReportJob ([A-Za-z0-9_-]{32,256})"\n', file.read_text())
        if not match:
            raise ValueError('Invalid protected credential configuration')
        # Share the wrapper lock. Timeouts still require operator reconciliation.
        lock_path = pathlib.Path('/home/ubuntu/costinsights-deploy-state/report.lock')
        with_lock = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        fcntl.flock(with_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        authorization = {'Authorization': 'ReportJob ' + match[1]}
        if args.read_services:
            request('/api/costs', 401, headers=authorization)
            request('/api/reports/history', 401, headers=authorization)
        request('/api/reports/' + args.report_month + '/pdf', 401, headers=authorization)
        raw, headers = request('/api/reports/generate?month=' + args.report_month, 200, headers=authorization)
        result = json.loads(raw)
        if result.get('message') != 'Report generated' or result.get('month') != args.report_month or result.get('key') != 'reports/aws-cost-' + args.report_month + '.pdf':
            raise ValueError('Unexpected report response')
        if 'no-store' not in headers.get('Cache-Control', ''):
            raise ValueError('Report response may be cacheable')
        raw, _ = request('/reports/' + args.report_month, 200, headers=authorization)
        if ('data-cost-report-month="' + args.report_month + '"').encode() not in raw or match[1].encode() in raw:
            raise ValueError('Unexpected report document')
        print('PASS: ReportJob scope, report generation and protected report document')
    request('/api/auth', 200, 'DELETE', opener=browser)
    request('/api/reports', 401, opener=browser)
    print('PASS: logout clears cookie access; no credentials or response bodies printed')

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Smoke checks cancelled; credentials suppressed.', file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('Smoke checks failed; credentials and response details suppressed. Stop and assess rollback.', file=sys.stderr)
        sys.exit(1)
