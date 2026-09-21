#!/usr/bin/env python3
"""
Test script that verifies Alloy is successfully collecting and forwarding logs to Loki.
Prints a unique test message and queries Loki to confirm the message appears in the logs.
"""

import os
import sys
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

# Configuration
# Build Loki endpoint from environment variables
LOKI_SERVICE = os.getenv("LOKI_SERVICE", "loki.dev.bigbang.mil")
PORT = os.getenv("PORT", "443")
LOKI_ENDPOINT = f"https://{LOKI_SERVICE}:{PORT}"

POD_NAME = os.getenv("HOSTNAME", "alloy-script-test")
CONTAINER_NAME = "alloy-script-test"
NAMESPACE = os.getenv("NAMESPACE", "alloy")
RETRIES = int(os.getenv("RETRIES", "5"))
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "30"))

# Wait time between retry attempts (seconds)
RETRY_INTERVAL = 3

# Fresh test pods can emit logs before Alloy has started tailing their files.
# Re-emitting the same marker during retries makes the test resilient to that lag.
EMIT_ON_RETRY = os.getenv("EMIT_ON_RETRY", "true").lower() == "true"

# How far back to search for logs (seconds)
SEARCH_LOOKBACK = 300


def print_test_message(message: str) -> None:
    """Print a test message with timestamp"""
    timestamp = datetime.now(timezone.utc).isoformat()
    print(f"[{timestamp}] {message}")
    sys.stdout.flush()


def query_loki(
    query_expr: str, start_time: datetime, end_time: datetime, limit: int = 100
) -> Optional[Dict[str, Any]]:
    """Query Loki for logs matching the given expression"""
    url = f"{LOKI_ENDPOINT}/loki/api/v1/query_range"

    # Convert datetime to nanosecond timestamps
    start_ns = int(start_time.timestamp() * 1e9)
    end_ns = int(end_time.timestamp() * 1e9)

    params = {
        "query": query_expr,
        "start": str(start_ns),
        "end": str(end_ns),
        "limit": str(limit),
    }

    query_string = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_string}"

    try:
        with urllib.request.urlopen(full_url, timeout=REQUEST_TIMEOUT) as response:
            data = json.loads(response.read().decode())
            return data
    except Exception as e:
        print(f"ERROR: Failed to query Loki: {e}")
        return None


def extract_log_lines(loki_response: Optional[Dict[str, Any]]) -> List[str]:
    """Extract all log lines from Loki response"""
    if not loki_response or loki_response.get("status") != "success":
        return []

    log_lines = []
    results = loki_response.get("data", {}).get("result", [])

    for result in results:
        for value_pair in result.get("values", []):
            # value_pair is [timestamp, log_line]
            if len(value_pair) >= 2:
                log_lines.append(value_pair[1])

    return log_lines


def test_log_ingestion(test_message: str) -> bool:
    """
    Test that a log message appears in Loki.
    Returns True if the test passes, False otherwise.
    """
    print_test_message("Starting log ingestion test")
    print_test_message(f"Loki endpoint: {LOKI_ENDPOINT}")
    print_test_message(f"Pod: {POD_NAME}, Namespace: {NAMESPACE}")
    print_test_message(f"Retry attempts: {RETRIES}, Interval: {RETRY_INTERVAL}s")
    print_test_message(f"Request timeout: {REQUEST_TIMEOUT:g}s")

    # Generate a unique test message with timestamp
    unique_id = int(time.time() * 1000)
    unique_message = f"{test_message} [TEST_ID:{unique_id}]"

    # Print the unique test message
    print("---")
    print_test_message(f"TEST MESSAGE: {unique_message}")
    print("---")

    # Build LogQL query
    query = (
        f'{{pod="{POD_NAME}",container="{CONTAINER_NAME}"}} '
        f'|= "TEST_ID:{unique_id}"'
    )

    # Retry loop to check if log appears in Loki
    for attempt in range(1, RETRIES + 1):
        print_test_message(
            f"Attempt {attempt}/{RETRIES}: Querying Loki for test message..."
        )

        # Query Loki for the test message
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(seconds=SEARCH_LOOKBACK)

        response = query_loki(query, start_time, end_time)

        if not response:
            print_test_message(f"WARNING: Could not query Loki on attempt {attempt}")
            if attempt < RETRIES:
                print_test_message(f"Waiting {RETRY_INTERVAL} seconds before retry...")
                time.sleep(RETRY_INTERVAL)
                continue
            else:
                print_test_message("FAILED: Could not query Loki after all retries")
                return False

        # Extract log lines
        log_lines = extract_log_lines(response)
        print_test_message(f"Retrieved {len(log_lines)} log lines from Loki")

        # Check if our unique message appears in the logs
        found = False
        for line in log_lines:
            if f"TEST_ID:{unique_id}" in line:
                found = True
                print_test_message(
                    f"SUCCESS: Found test message in Loki on attempt {attempt}!"
                )
                print_test_message(
                    f"Matched line: {line[:200]}"
                )  # Print first 200 chars
                return True

        if not found:
            print_test_message(f"Test message not found in attempt {attempt}")
            if attempt < RETRIES:
                if EMIT_ON_RETRY:
                    print_test_message(
                        f"Re-emitting test message for retry: {unique_message}"
                    )
                print_test_message(f"Waiting {RETRY_INTERVAL} seconds before retry...")
                time.sleep(RETRY_INTERVAL)
            else:
                print_test_message(
                    f"FAILED: Test message not found after {RETRIES} attempts"
                )
                print_test_message(f"Expected to find: TEST_ID:{unique_id}")
                print_test_message("Recent logs from Loki:")
                for line in log_lines[-10:]:  # Show last 10 lines
                    print_test_message(f"  {line[:200]}")
                return False

    return False


def main() -> None:
    print("=" * 60)
    print_test_message("Alloy Log Ingestion Test")
    print("=" * 60)

    # Run the test
    success = test_log_ingestion("Alloy test message")

    print("=" * 60)
    if success:
        print_test_message("TEST PASSED: Alloy is successfully forwarding logs to Loki")
        print("=" * 60)
        sys.exit(0)
    else:
        print_test_message("TEST FAILED: Logs not found in Loki")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
