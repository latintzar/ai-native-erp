"""Proof-only socket fence. Installed by tools/offline-python.py, never app startup."""
import ipaddress
import socket

_connect = socket.socket.connect
_connect_ex = socket.socket.connect_ex
_getaddrinfo = socket.getaddrinfo


def _local(host):
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _check(sock, address):
    if sock.family in (socket.AF_INET, socket.AF_INET6) and not _local(address[0]):
        raise PermissionError("Offline proof permits loopback connections only.")


def connect(sock, address):
    _check(sock, address)
    return _connect(sock, address)


def connect_ex(sock, address):
    _check(sock, address)
    return _connect_ex(sock, address)


def getaddrinfo(host, *args, **kwargs):
    if host is not None and not _local(host):
        raise PermissionError("Offline proof permits loopback DNS only.")
    return _getaddrinfo(host, *args, **kwargs)


socket.socket.connect = connect
socket.socket.connect_ex = connect_ex
socket.getaddrinfo = getaddrinfo
