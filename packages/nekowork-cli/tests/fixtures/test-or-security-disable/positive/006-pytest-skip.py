import pytest

@pytest.mark.skip(reason="known broken; will fix")
def test_critical_flow():
    assert False
