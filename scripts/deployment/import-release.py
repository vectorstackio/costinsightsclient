#!/usr/bin/python3
"""Unprivileged import of a reviewed private build, with disk/path checks."""
import argparse
import hashlib
import os
import pathlib
import posixpath
import re
import stat
import sys
import tarfile

RESERVE = 5 * 1024**3

def inspect_members(members):
    names = {}
    size = 0
    for member in members:
        name = posixpath.normpath(member.name)
        if name in ('', '.'):
            continue
        if member.name.startswith('/') or '..' in member.name.split('/') or name.startswith('../'):
            raise ValueError('Archive path escapes candidate')
        if name in names or not (member.isfile() or member.isdir() or member.issym() or member.islnk()) or member.mode & 0o7000:
            raise ValueError('Duplicate/special/privileged archive member')
        names[name] = member
        if member.isfile():
            size += member.size
    links = {name for name, value in names.items() if value.issym() or value.islnk()}
    for name, member in names.items():
        parent = posixpath.dirname(name)
        while parent:
            if parent in links:
                raise ValueError('Archive member traverses a link')
            parent = posixpath.dirname(parent)
        if name in links:
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), member.linkname) if member.issym() else member.linkname)
            if member.linkname.startswith('/') or target not in names or target in links or not (names[target].isfile() or names[target].isdir()):
                raise ValueError('Archive link target is not an internal ordinary member')
    return [member for member in members if posixpath.normpath(member.name) not in ('', '.')], size


def disk_budget(free, expanded):
    if free < expanded + RESERVE:
        raise ValueError('Insufficient production disk reserve; import refused')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute', action='store_true')
    parser.add_argument('--archive')
    parser.add_argument('--sha256')
    parser.add_argument('--candidate')
    args = parser.parse_args()
    if not args.execute:
        print('No import performed; separate approval and --execute required.')
        return
    if os.geteuid() == 0 or not re.fullmatch(r'/home/ubuntu/costinsights-releases/[A-Za-z0-9_-]+', args.candidate or ''):
        raise ValueError('Unprivileged application account and fresh candidate path required')
    if not re.fullmatch(r'[a-f0-9]{64}', args.sha256 or ''):
        raise ValueError('Independently reviewed artifact digest required')
    archive = pathlib.Path(args.archive)
    info = archive.lstat()
    if archive.is_symlink() or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError('Private application-owned artifact required')
    with archive.open('rb') as stream:
        digest = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    if digest.hexdigest() != args.sha256:
        raise ValueError('Artifact digest mismatch')
    candidate = pathlib.Path(args.candidate)
    if candidate.exists() or candidate.is_symlink():
        raise ValueError('Candidate already exists')
    parent = candidate.parent
    parent_info = parent.lstat()
    if parent.is_symlink() or parent_info.st_uid != os.geteuid() or stat.S_IMODE(parent_info.st_mode) != 0o700:
        raise ValueError('Private application-owned release parent required')
    with tarfile.open(archive, 'r:*') as source:
        members, expanded = inspect_members(source.getmembers())
        space = os.statvfs(parent)
        disk_budget(space.f_bavail * space.f_frsize, expanded)
        candidate.mkdir(mode=0o700)
        # Validated paths/links; no root directory member can relax mode 0700.
        source.extractall(candidate, members=members)
    print('Private release imported; live application unchanged. Continue accept verification.')

if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('Import refused/failed; details suppressed. Keep the old release and investigate partial candidate privately.', file=sys.stderr)
        sys.exit(1)
