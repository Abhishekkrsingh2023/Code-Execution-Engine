"""Centralized rate limiter configuration for the application.

Configures slowapi rate limiter utilizing the client's remote IP address.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
