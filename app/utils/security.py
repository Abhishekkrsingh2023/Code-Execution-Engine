import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt


def hash_password(password: str) -> str:
    """_summary_
    Hashes a plaintext password using bcrypt with an automatically generated salt.

    Args:
        password (str): Plaintext password to hash.

    Returns:
        str: Bcrypt hashed password string.
    """
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """_summary_
    Verifies a plaintext password against a stored bcrypt hash using constant-time check.

    Args:
        plain_password (str): Plaintext password to verify.
        hashed_password (Optional[str]): Stored bcrypt hash string.

    Returns:
        bool: True if password matches hash, False otherwise.
    """
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def generate_otp(length: int = 6) -> str:
    """_summary_
    Generates a cryptographically secure random numeric One-Time Password (OTP).

    Args:
        length (int): Number of digits in the OTP (default is 6).

    Returns:
        str: Generated OTP string with leading zeroes padded.
    """
    max_val = 10 ** length
    otp_number = secrets.randbelow(max_val)
    return f"{otp_number:0{length}d}"


def get_otp_expiry(minutes: int = 10) -> datetime:
    """_summary_
    Calculates a future UTC timestamp for OTP expiration.

    Args:
        minutes (int): Minutes from now until expiration (default is 10).

    Returns:
        datetime: Timezone-aware UTC expiration datetime.
    """
    return datetime.now(timezone.utc) + timedelta(minutes=minutes)
