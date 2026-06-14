"""Deal Intelligence Agent — Backend API Test Suite

Runs all backend endpoints sequentially using httpx.
Stateful: deal_id and meeting_id from earlier tests are reused in later ones.
"""

import httpx
import sys
import time
import wave
import struct
import io

BASE = "http://localhost:8000"
TESTS_PASSED = 0
TESTS_FAILED = 0
FAILURES = []

deal_id = None
meeting_id = None

client = httpx.Client(base_url=BASE, timeout=30, follow_redirects=True)


def test(name, fn):
    global TESTS_PASSED, TESTS_FAILED
    try:
        result = fn()
        if result:
            TESTS_PASSED += 1
            print(f"  PASS  {name}")
        else:
            TESTS_FAILED += 1
            FAILURES.append(name)
            print(f"  FAIL  {name}")
    except Exception as e:
        TESTS_FAILED += 1
        FAILURES.append(name)
        print(f"  FAIL  {name} — Exception: {e}")


def assert_eq(label, actual, expected):
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")
    return True


def assert_in(label, actual, collection):
    if actual not in collection:
        raise AssertionError(f"{label}: {actual!r} not in {collection!r}")
    return True


def assert_status(resp, expected):
    if resp.status_code != expected:
        raise AssertionError(f"HTTP {resp.status_code}, expected {expected}. Body: {resp.text[:300]}")
    return True


def assert_has_keys(d, keys):
    missing = [k for k in keys if k not in d]
    if missing:
        raise AssertionError(f"Missing keys: {missing}. Keys present: {list(d.keys())}")
    return True


def make_wav_bytes():
    """Create a minimal 5-second silent WAV (16kHz, mono, 16-bit)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(struct.pack("<" + "h" * (16000 * 5), *([0] * (16000 * 5))))
    return buf.getvalue()


print("=" * 60)
print("  Deal Intelligence Agent — API Test Suite")
print("=" * 60)


# ── TEST 1 ────────────────────────────────────────────────────────────────────
print("\nTEST 1 — GET /health")

def test_1():
    r = client.get("/health")
    assert_status(r, 200)
    body = r.json()
    assert_eq("status", body.get("status"), "ok")
    return True

test("GET /health", test_1)


# ── TEST 2 ────────────────────────────────────────────────────────────────────
print("\nTEST 2 — POST /api/v1/deals/ (Create Deal)")

def test_2():
    global deal_id
    payload = {
        "name": "API Test Deal",
        "company": "TestCo",
        "contact_name": "Alice",
        "contact_role": "CEO",
        "deal_value": 75000,
        "stage": "proposal",
    }
    r = client.post("/api/v1/deals/", json=payload)
    assert_in("status", r.status_code, [200, 201])
    body = r.json()
    assert_has_keys(body, ["id", "hindsight_tags"])
    deal_id = body["id"]
    if not isinstance(body["hindsight_tags"], list) or len(body["hindsight_tags"]) == 0:
        raise AssertionError(f"hindsight_tags is empty or not a list: {body['hindsight_tags']}")
    print(f"    -> deal_id = {deal_id}")
    return True

test("Create Deal", test_2)


# ── TEST 3 ────────────────────────────────────────────────────────────────────
print("\nTEST 3 — GET /api/v1/deals/ (List Deals)")

def test_3():
    r = client.get("/api/v1/deals/")
    assert_status(r, 200)
    body = r.json()
    if not isinstance(body, list):
        raise AssertionError(f"Expected list, got {type(body).__name__}")
    if len(body) < 1:
        raise AssertionError("Expected at least 1 deal, got 0")
    print(f"    -> {len(body)} deal(s) returned")
    return True

test("List Deals", test_3)


# ── TEST 4 ────────────────────────────────────────────────────────────────────
print(f"\nTEST 4 — GET /api/v1/deals/{deal_id} (Get Single Deal)")

def test_4():
    r = client.get(f"/api/v1/deals/{deal_id}")
    assert_status(r, 200)
    body = r.json()
    assert_eq("id", body["id"], deal_id)
    assert_eq("company", body["company"], "TestCo")
    return True

test("Get Single Deal", test_4)


# ── TEST 5 ────────────────────────────────────────────────────────────────────
print(f"\nTEST 5 — PUT /api/v1/deals/{deal_id} (Update Deal)")

def test_5():
    r = client.put(f"/api/v1/deals/{deal_id}", json={"stage": "negotiation"})
    assert_status(r, 200)
    body = r.json()
    assert_eq("stage", body["stage"], "negotiation")
    return True

test("Update Deal", test_5)


# ── TEST 6 ────────────────────────────────────────────────────────────────────
print(f"\nTEST 6 — POST /api/v1/deals/{deal_id}/meetings/ (Create Meeting)")

def test_6():
    global meeting_id
    r = client.post(f"/api/v1/deals/{deal_id}/meetings/", json={"title": "API Test Meeting"})
    assert_in("status", r.status_code, [200, 201])
    body = r.json()
    assert_has_keys(body, ["id", "processing_status", "meeting_number"])
    meeting_id = body["id"]
    assert_eq("processing_status", body["processing_status"], "pending")
    assert_eq("meeting_number", body["meeting_number"], 1)
    print(f"    -> meeting_id = {meeting_id}")
    return True

test("Create Meeting", test_6)


# ── TEST 7 ────────────────────────────────────────────────────────────────────
print(f"\nTEST 7 — GET /api/v1/deals/{deal_id}/meetings/ (List Meetings)")

def test_7():
    r = client.get(f"/api/v1/deals/{deal_id}/meetings/")
    assert_status(r, 200)
    body = r.json()
    if not isinstance(body, list):
        raise AssertionError(f"Expected list, got {type(body).__name__}")
    if len(body) != 1:
        raise AssertionError(f"Expected 1 meeting, got {len(body)}")
    if body[0]["id"] != meeting_id:
        raise AssertionError(f"Expected id {meeting_id}, got {body[0]['id']}")
    return True

test("List Meetings", test_7)


# ── TEST 8 ────────────────────────────────────────────────────────────────────
print(f"\nTEST 8 — GET /api/v1/meetings/{meeting_id} (Get Meeting)")

def test_8():
    r = client.get(f"/api/v1/meetings/{meeting_id}")
    assert_status(r, 200)
    body = r.json()
    assert_eq("id", body["id"], meeting_id)
    assert_eq("deal_id", body["deal_id"], deal_id)
    return True

test("Get Meeting", test_8)


# ── TEST 9 ────────────────────────────────────────────────────────────────────
print(f"\nTEST 9 — GET /api/v1/meetings/{meeting_id}/status (Get Processing Status)")

def test_9():
    r = client.get(f"/api/v1/meetings/{meeting_id}/status")
    assert_status(r, 200)
    body = r.json()
    assert_has_keys(body, ["meeting_id", "status", "step_message"])
    valid = {"pending", "transcribing", "extracting", "storing_memory", "complete", "failed"}
    assert_in("status", body["status"], valid)
    print(f"    -> status = {body['status']!r}, step = {body['step_message']!r}")
    return True

test("Get Processing Status", test_9)


# ── TEST 10 ───────────────────────────────────────────────────────────────────
print(f"\nTEST 10 — POST /api/v1/meetings/{meeting_id}/upload (Upload Audio)")

def test_10():
    wav = make_wav_bytes()
    r = client.post(
        f"/api/v1/meetings/{meeting_id}/upload",
        files={"audio": ("test_silence.wav", wav, "audio/wav")},
    )
    assert_status(r, 200)
    body = r.json()
    assert_eq("status", body["status"], "processing_started")
    print("    -> Pipeline started. Transcript may fail on synthetic audio (no speech) — this is expected.")
    return True

test("Upload Audio", test_10)


# ── TEST 11 ───────────────────────────────────────────────────────────────────
print(f"\nTEST 11 — Poll /api/v1/meetings/{meeting_id}/status (Pipeline Completion)")

def test_11():
    start = time.time()
    deadline = 60
    final_status = None
    while True:
        elapsed = time.time() - start
        if elapsed > deadline:
            break
        r = client.get(f"/api/v1/meetings/{meeting_id}/status")
        body = r.json()
        st = body["status"]
        step = body["step_message"]
        print(f"    [{elapsed:4.0f}s] {st:20s} — {step}")
        if st in ("complete", "failed"):
            final_status = st
            break
        time.sleep(3)

    if final_status is None:
        raise AssertionError(f"Pipeline did not finish within {deadline}s (last status: {st})")
    print(f"    -> Pipeline ended with status: {final_status}")
    return True

test("Pipeline Completion", test_11)


# ── TEST 12 ───────────────────────────────────────────────────────────────────
print(f"\nTEST 12 — GET /api/v1/deals/{deal_id}/memory (Get Deal Memory)")

def test_12():
    r = client.get(f"/api/v1/deals/{deal_id}/memory")
    assert_status(r, 200)
    body = r.json()
    assert_has_keys(body, ["episodic", "semantic", "procedural", "total_count"])
    for key in ("episodic", "semantic", "procedural"):
        if not isinstance(body[key], list):
            raise AssertionError(f"{key} is not a list: {type(body[key]).__name__}")
    print(f"    -> episodic={len(body['episodic'])}, semantic={len(body['semantic'])}, procedural={len(body['procedural'])}, total={body['total_count']}")
    return True

test("Get Deal Memory", test_12)


# ── TEST 13 ───────────────────────────────────────────────────────────────────
print(f"\nTEST 13 — GET /api/v1/deals/{deal_id}/brief (Get Pre-Meeting Brief)")

def test_13():
    r = client.get(f"/api/v1/deals/{deal_id}/brief")
    assert_status(r, 200)
    body = r.json()
    required = ["deal_context", "recommended_strategies", "recurring_risks",
                 "stakeholders_to_know", "competitor_context", "confidence", "memory_sources"]
    assert_has_keys(body, required)
    print(f"    -> confidence={body.get('confidence')!r}")
    return True

test("Get Pre-Meeting Brief", test_13)


# ── TEST 14 ───────────────────────────────────────────────────────────────────
print(f"\nTEST 14 — GET /api/v1/deals/{deal_id}/summary (Get Deal Summary)")

def test_14():
    r = client.get(f"/api/v1/deals/{deal_id}/summary")
    assert_status(r, 200)
    body = r.json()
    assert_eq("deal_id", body.get("deal_id"), deal_id)
    assert_has_keys(body, ["recurring_objections", "key_stakeholders", "deal_risk_level"])
    print(f"    -> risk_level={body.get('deal_risk_level')!r}")
    return True

test("Get Deal Summary", test_14)


# ── TEST 15 ───────────────────────────────────────────────────────────────────
print(f"\nTEST 15 — GET /api/v1/meetings/{meeting_id}/intelligence (Get Intelligence)")

def test_15():
    r = client.get(f"/api/v1/meetings/{meeting_id}/intelligence")
    if r.status_code == 200:
        body = r.json()
        print(f"    -> Intelligence exists (status 200). Keys: {list(body.keys())[:5]}...")
        return True
    elif r.status_code == 404:
        print(f"    -> Intelligence not available (404) — expected with synthetic audio")
        return True
    else:
        raise AssertionError(f"Unexpected status {r.status_code}: {r.text[:200]}")

test("Get Intelligence", test_15)


# ── TEST 16 ───────────────────────────────────────────────────────────────────
print("\nTEST 16 — Error Handling: GET non-existent deal")

def test_16():
    r = client.get("/api/v1/deals/00000000-0000-0000-0000-000000000000")
    assert_eq("status", r.status_code, 404)
    return True

test("Non-existent Deal 404", test_16)


# ── TEST 17 ───────────────────────────────────────────────────────────────────
print(f"\nTEST 17 — DELETE /api/v1/deals/{deal_id} (Cleanup)")

def test_17():
    r = client.delete(f"/api/v1/deals/{deal_id}")
    assert_in("status", r.status_code, [200, 204])
    return True

test("Delete Test Deal", test_17)


# ── SUMMARY ───────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print(f"  TEST SUMMARY")
print(f"  Passed: {TESTS_PASSED}/17")
print(f"  Failed: {TESTS_FAILED}/17")
if FAILURES:
    print(f"  Failures:")
    for f in FAILURES:
        print(f"    - {f}")
else:
    print(f"  All tests passed!")
print("=" * 60)

sys.exit(0 if TESTS_FAILED == 0 else 1)
