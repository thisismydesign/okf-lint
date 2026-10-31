"""Deterministic attester: confirm the executed SQL equals the sanctioned computation."""


def attest(receipt: dict, computation: str, parameters: dict) -> dict:
    expected = computation
    for name, value in parameters.items():
        expected = expected.replace(f"@{name}", repr(value))
    ok = receipt.get("executed_sql", "").strip() == expected.strip()
    return {"verdict": "ok" if ok else "mismatch", "job_id": receipt.get("job_id")}
