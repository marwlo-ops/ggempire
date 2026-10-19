import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "diagnose_api.py"
SPEC = importlib.util.spec_from_file_location("diagnose_api", SCRIPT)
diagnose_api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(diagnose_api)


class SummarizeTests(unittest.TestCase):
    def test_dict_shape_is_preserved_without_values_at_depth_limit(self):
        value = {"content": {"A": {"N": "Alliance", "M": [{"N": "private-player-name", "OID": 123}]}}}
        result = diagnose_api.summarize(value)
        self.assertEqual(result["content"]["A"]["N"], "Alliance")
        self.assertEqual(result["content"]["A"]["M"]["type"], "array")
        self.assertNotIn("private-player-name", repr(result))

    def test_long_strings_are_redacted_to_length(self):
        result = diagnose_api.summarize({"token": "x" * 300})
        self.assertEqual(result["token"], {"type": "string", "length": 300})

    def test_empty_arrays_are_safe(self):
        self.assertEqual(diagnose_api.summarize([]), {"type": "array", "length": 0, "samples": []})

    def test_expected_commands_are_configured(self):
        self.assertEqual(set(diagnose_api.COMMANDS), {"alliance", "player_ranking", "alliance_ranking"})
        self.assertTrue(all(command.startswith(("ain/", "llsp/", "llsw/")) for command in diagnose_api.COMMANDS.values()))


if __name__ == "__main__":
    unittest.main()
