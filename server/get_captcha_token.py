#!/usr/bin/env python3
"""
Get DKB Friendly Captcha token using SeleniumBase
Based on: https://gist.github.com/stoppegp/b14017a0414f99b2ec379fbd2c4f93c5
"""
import asyncio
import json
import logging
import time
import sys
import mycdp
from seleniumbase import SB

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_dkb_redeem_token(timeout=400, headless=True):
    """
    Get DKB Friendly Captcha redeem token

    Args:
        timeout: Maximum seconds to wait for captcha solving
        headless: Run browser in headless mode

    Returns:
        str: Redeem token or False on error
    """
    activate_events = []
    redeem_events = []

    def listen_to_captcha_redeem(page, redeem_events_loc, activate_events_loc):
        async def handler(evt):
            if evt.response.url == "https://eu.frcapi.com/api/v2/captcha/redeem":
                redeem_events_loc.append(evt)
                logger.info("redeem token request logged!")
            elif evt.response.url == "https://eu.frcapi.com/api/v2/captcha/quote":
                activate_events_loc.append(evt)
                logger.info("captcha activated")

        page.add_handler(mycdp.network.ResponseReceived, handler)

    async def get_redeem_response(page, redeem_events_loc):
        retries = 0
        while True:
            retries += 1
            if len(redeem_events_loc) == 0 and retries <= timeout:
                logger.debug("Still waiting for captcha solving...")
                await asyncio.sleep(1)
            else:
                # redeem token response found or timeout
                break
        if len(redeem_events_loc) > 0:
            # redeem token response found
            logger.debug("redeem token response found")
            try:
                res = await page.send(
                    mycdp.network.get_response_body(redeem_events[-1].request_id)
                )
                return json.loads(res[0])["data"]["redeem_token"]
            except Exception as e:
                logger.error(f"Could not extract redeem token from response: {e}")
                return False
        else:
            logger.error("Timeout: redeem token request not found")
            return False

    try:
        with SB(
            uc=True,
            locale="de",
            disable_features="IsolateOrigins,site-per-process",
            chromium_arg="--disable-site-isolation-trials",
            headless=headless,
        ) as sb:
            sb.activate_cdp_mode("about:blank")
            tab = sb.cdp.page
            listen_to_captcha_redeem(tab, redeem_events, activate_events)

            logger.info("Loading login page...")
            sb.cdp.open("https://banking.dkb.de/login")

            for _ in range(50):

                if len(activate_events) > 0:
                    # captcha was activated
                    break

                time.sleep(1)

                logger.debug("trying to click captcha button")

                # clicking on cookie banner if visible
                try:
                    sb.switch_to_default_content()
                    sb.find_element(
                        "#usercentrics-cmp-ui::shadow button.uc-accept-button"
                    ).click()
                    logger.debug("Dismissed cookie banner")
                except:
                    pass

                # activate captcha if already visible
                try:
                    sb.switch_to_frame("iframe.frc-i-widget", timeout=1)
                except Exception as e:
                    # captcha not visible, reloading page
                    logger.debug("Did not find captcha checkbox")
                    sb.cdp.refresh()
                    time.sleep(1)
                    continue

                try:
                    # click on button
                    sb.find_element("button.checkbox", timeout=1).click()
                    logger.info("Clicked on Captcha")
                    break
                except:
                    # try again if not successful
                    pass

            loop = sb.cdp.get_event_loop()
            token = loop.run_until_complete(get_redeem_response(tab, redeem_events))
            return token
    except Exception as e:
        logger.error(f"Error getting captcha token: {e}")
        return False


if __name__ == "__main__":
    # Get token - use longer timeout in headless mode as captcha solving takes longer
    token = get_dkb_redeem_token(timeout=400, headless=True)

    if token:
        # Output as JSON for easy parsing
        print(json.dumps({
            "success": True,
            "token": token
        }))
        sys.exit(0)
    else:
        print(json.dumps({
            "success": False,
            "error": "Failed to get captcha token"
        }))
        sys.exit(1)
