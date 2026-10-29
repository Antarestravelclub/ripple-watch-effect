"""Authenticated integration checks; credentials are read only from environment."""
import json
import os
import unittest
import requests


class AdminAccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        session = json.loads(os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"])
        cls.url = os.environ["VITE_SUPABASE_URL"] + "/rest/v1/rpc/"
        cls.headers = {
            "apikey": os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": "Bearer " + session["access_token"],
        }

    def rpc(self, name, payload=None):
        response = requests.post(self.url + name, headers=self.headers, json=payload or {}, timeout=20)
        self.assertEqual(response.status_code, 204 if name == "lock_admin_access" else 200)
        return response.json() if response.content else None

    def tearDown(self):
        self.rpc("lock_admin_access")

    def test_admin_code_required_after_lock(self):
        self.rpc("lock_admin_access")
        self.assertIs(self.rpc("has_admin_access"), False)

    def test_configured_four_digit_code_unlocks(self):
        self.assertIs(self.rpc("verify_admin_pin", {"p_pin": os.environ["ADMIN_TEST_PIN"]}), True)
        self.assertIs(self.rpc("has_admin_access"), True)

    def test_wrong_code_does_not_unlock(self):
        self.rpc("lock_admin_access")
        self.assertIs(self.rpc("verify_admin_pin", {"p_pin": "0000"}), False)
        self.assertIs(self.rpc("has_admin_access"), False)


if __name__ == "__main__":
    unittest.main()