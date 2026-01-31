#!/usr/bin/env python3
"""
Test DKB authentication with different username formats
"""
import sys
from dkb_robo import DKBRobo

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: test_dkb_auth.py <username> <password>")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]

    print(f"Testing authentication for user: {username}")
    print(f"Password length: {len(password)}")
    print()

    # Try with original username
    print(f"Attempt 1: Using username as-is: '{username}'")
    try:
        with DKBRobo(dkb_user=username, dkb_password=password, debug=False) as dkb:
            print("✓ SUCCESS! Logged in successfully")
            print(f"Accounts found: {len(dkb.account_dic)}")
    except Exception as e:
        print(f"✗ FAILED: {e}")

    # Try without _p suffix if present
    if username.endswith('_p'):
        username_no_suffix = username[:-2]
        print(f"\nAttempt 2: Trying without '_p' suffix: '{username_no_suffix}'")
        try:
            with DKBRobo(dkb_user=username_no_suffix, dkb_password=password, debug=False) as dkb:
                print("✓ SUCCESS! Logged in successfully")
                print(f"Accounts found: {len(dkb.account_dic)}")
        except Exception as e:
            print(f"✗ FAILED: {e}")
