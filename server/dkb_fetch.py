#!/usr/bin/env python3
"""
DKB Transaction Fetcher using dkb-robo library with Friendly Captcha support
"""
import sys
import json
import argparse
import subprocess
import time
import logging
from datetime import datetime, timedelta
from dkb_robo import DKBRobo
from dkb_robo.authentication import Authentication, APPAuthentication
from dkb_robo.utilities import DKBRoboError

def get_captcha_token(max_retries=3):
    """
    Get Friendly Captcha token using SeleniumBase with retry logic

    Args:
        max_retries: Maximum number of retry attempts (default 3)

    Returns:
        str: Captcha token or None on error
    """
    print("[dkb_fetch.py] Getting captcha token...", file=sys.stderr)

    for attempt in range(1, max_retries + 1):
        print(f"[dkb_fetch.py] Captcha attempt {attempt}/{max_retries}...", file=sys.stderr)

        try:
            # Run the captcha solver script
            # Use longer timeout (450s) as Friendly Captcha can take a long time in headless mode
            result = subprocess.run(
                ['python3', '/app/server/get_captcha_token.py'],
                capture_output=True,
                text=True,
                timeout=450
            )

            if result.returncode == 0:
                data = json.loads(result.stdout)
                if data.get('success'):
                    token = data.get('token')
                    print(f"[dkb_fetch.py] Got captcha token (length: {len(token)})", file=sys.stderr)
                    return token

            print(f"[dkb_fetch.py] Attempt {attempt} failed: {result.stderr}", file=sys.stderr)

        except subprocess.TimeoutExpired:
            print(f"[dkb_fetch.py] Attempt {attempt} timed out after 180s", file=sys.stderr)
        except Exception as e:
            print(f"[dkb_fetch.py] Attempt {attempt} error: {e}", file=sys.stderr)

        if attempt < max_retries:
            print(f"[dkb_fetch.py] Retrying in 5 seconds...", file=sys.stderr)
            import time
            time.sleep(5)

    print(f"[dkb_fetch.py] Failed to get captcha token after {max_retries} attempts", file=sys.stderr)
    return None


def patch_dkb_authentication(captcha_token):
    """
    Monkey-patch dkb-robo Authentication to include captcha token
    and extend MFA timeout for phone approval

    Args:
        captcha_token: The Friendly Captcha redeem token
    """
    logger = logging.getLogger(__name__)

    # Patch 1: Add captcha token to login
    def patched_token_get(self):
        """Patched version that includes captcha_token"""
        logger.debug("Authentication._token_get() [PATCHED WITH CAPTCHA]\n")

        # login via API with captcha token
        data_dic = {
            "captcha_token": captcha_token,
            "grant_type": "banking_user_sca",
            "username": self.dkb_user,
            "password": self.dkb_password,
            "sca_type": "web-login",
        }
        response = self.client.post(self.base_url + "/token", data=data_dic)
        if response.status_code == 200:
            self.token_dic = response.json()
        else:
            raise DKBRoboError(
                f"Login failed: 1st factor authentication failed. RC: {response.status_code}"
            )
        logger.debug("Authentication._token_get() ended\n")

    # Apply the captcha patch
    Authentication._token_get = patched_token_get


def patch_mfa_timeout():
    """
    Monkey-patch APPAuthentication.finalize to extend MFA timeout
    and redirect print output to stderr (to not corrupt JSON output)
    Must be called before any DKBRobo instance is created
    """
    logger = logging.getLogger(__name__)

    # Patch _print to use stderr instead of stdout
    def patched_app_print(self, devicename):
        """Patched version that prints to stderr"""
        logger.debug("APPAuthentication._print() [PATCHED TO STDERR]\n")
        if devicename:
            print(f'[dkb_fetch.py] Check your banking app on "{devicename}" and confirm login...', file=sys.stderr)
        else:
            print("[dkb_fetch.py] Check your banking app and confirm login...", file=sys.stderr)

    # Patch: Extend MFA timeout from 50s to 120s for phone approval
    def patched_app_finalize(self, challenge_id, challenge_dic, devicename):
        """Patched version with longer timeout for phone approval"""
        logger.debug("APPAuthentication.finalize() [PATCHED WITH EXTENDED TIMEOUT]\n")

        self._print(devicename)

        cnt = 0
        mfa_completed = False
        # Extended timeout: 24 iterations × 5 seconds = 120 seconds for phone approval
        max_iterations = 24
        print(f"[dkb_fetch.py] Waiting for phone approval (up to {max_iterations * 5}s)...", file=sys.stderr)

        while cnt <= max_iterations:
            response = self.client.get(
                self.base_url + f"/mfa/mfa/challenges/{challenge_id}"
            )
            cnt += 1
            if response.status_code == 200:
                polling_dic = response.json()
                if (
                    "data" in polling_dic
                    and "attributes" in polling_dic["data"]
                    and "verificationStatus" in polling_dic["data"]["attributes"]
                ):
                    # check processing status
                    mfa_completed = self._check(polling_dic, cnt)
                    if mfa_completed:
                        print(f"[dkb_fetch.py] Phone approval received!", file=sys.stderr)
                        break
                else:
                    logger.error("error parsing polling response: %s", polling_dic)
            else:
                logger.error("Polling request failed. RC: %s", response.status_code)

            if cnt % 4 == 0:
                print(f"[dkb_fetch.py] Still waiting for approval... ({cnt * 5}s)", file=sys.stderr)
            time.sleep(5)

        logger.debug("APPAuthentication.finalize(): %s\n", mfa_completed)
        return mfa_completed

    # Apply the patches at module level
    APPAuthentication._print = patched_app_print
    APPAuthentication.finalize = patched_app_finalize
    print("[dkb_fetch.py] MFA patches applied (120s timeout, stderr output)", file=sys.stderr)


# Apply MFA timeout patch immediately when module is loaded
patch_mfa_timeout()


def fetch_transactions(username, password, account_id=None, days=90):
    """
    Fetch transactions from DKB account

    Args:
        username: DKB username
        password: DKB password
        account_id: Optional specific account ID
        days: Number of days to fetch (default 90)

    Returns:
        JSON string with accounts and transactions
    """
    # Log that script was called
    print(f"[dkb_fetch.py] Script called with:", file=sys.stderr)
    print(f"[dkb_fetch.py] - username: {username}", file=sys.stderr)
    print(f"[dkb_fetch.py] - password length: {len(password) if password else 0}", file=sys.stderr)
    print(f"[dkb_fetch.py] - account_id: {account_id}", file=sys.stderr)
    print(f"[dkb_fetch.py] - days: {days}", file=sys.stderr)

    try:
        # Get captcha token first
        captcha_token = get_captcha_token()
        if not captcha_token:
            return json.dumps({
                'success': False,
                'error': 'Failed to get captcha token'
            })

        # Patch dkb-robo to use the captcha token
        patch_dkb_authentication(captcha_token)
        # Login to DKB
        # mfa_device=1 auto-selects the first (preferred) device to avoid interactive prompt
        # debug=True for detailed logging
        with DKBRobo(dkb_user=username, dkb_password=password, mfa_device=1, debug=True) as dkb:
            result = {
                'success': True,
                'accounts': [],
                'transactions': []
            }

            # Get account list
            accounts = []
            for idx, account in dkb.account_dic.items():
                account_info = {
                    'id': account.get('id'),
                    'iban': account.get('iban'),
                    'name': account.get('name'),
                    'type': account.get('type'),
                    'balance': account.get('amount'),
                    'currency': account.get('currencycode', 'EUR'),
                    'holder': account.get('holdername'),
                    'productGroup': account.get('productgroup')
                }
                accounts.append(account_info)

            result['accounts'] = accounts

            # If specific account requested, fetch only that one
            if account_id:
                account_indices = [idx for idx, acc in dkb.account_dic.items()
                                 if acc.get('id') == account_id]
                if not account_indices:
                    return json.dumps({
                        'success': False,
                        'error': f'Account {account_id} not found'
                    })
                target_indices = account_indices
            else:
                # Fetch all accounts
                target_indices = list(dkb.account_dic.keys())

            # Fetch transactions for each account
            date_from = datetime.now() - timedelta(days=days)
            date_to = datetime.now()

            # Format dates in German format DD.MM.YYYY
            date_from_str = date_from.strftime('%d.%m.%Y')
            date_to_str = date_to.strftime('%d.%m.%Y')

            for idx in target_indices:
                account = dkb.account_dic[idx]
                account_type = account.get('type')
                transaction_url = account.get('transactions')

                if not transaction_url:
                    # Skip accounts without transaction URL
                    continue

                try:
                    # Fetch transactions using the transaction URL and type
                    trans_list = dkb.get_transactions(
                        transaction_url,
                        account_type,
                        date_from_str,
                        date_to_str
                    )

                    # Convert transactions to our format
                    for trans in trans_list:
                        # Map dkb-robo transaction fields to our format
                        # Checking account: peer, reasonforpayment
                        # Credit card: text field contains description
                        payee = trans.get('peer', trans.get('text', ''))
                        purpose = trans.get('reasonforpayment', trans.get('postingtext', trans.get('text', '')))

                        transaction = {
                            'accountId': account.get('id'),
                            'accountIban': account.get('iban'),
                            'bookingDate': trans.get('bdate'),
                            'valueDate': trans.get('vdate', trans.get('bdate')),
                            'payee': payee,
                            'purpose': purpose,
                            'amount': float(trans.get('amount', 0)),
                            'currency': trans.get('currencycode', account.get('currencycode', 'EUR')),
                            'source': 'dkb-robo'
                        }
                        result['transactions'].append(transaction)

                except Exception as e:
                    print(f"Error fetching transactions for account {idx}: {e}", file=sys.stderr)
                    continue

            return json.dumps(result, indent=2)

    except Exception as e:
        return json.dumps({
            'success': False,
            'error': str(e)
        })

def main():
    parser = argparse.ArgumentParser(description='Fetch DKB transactions')
    parser.add_argument('--username', required=True, help='DKB username')
    parser.add_argument('--password', required=True, help='DKB password')
    parser.add_argument('--account-id', help='Specific account ID (optional)')
    parser.add_argument('--days', type=int, default=90, help='Number of days to fetch')

    args = parser.parse_args()

    result = fetch_transactions(
        args.username,
        args.password,
        args.account_id,
        args.days
    )

    print(result)

if __name__ == '__main__':
    main()
