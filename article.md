# I Taught Hindsight to Remember Sales Calls Without Remembering Noise

## The Moment It Clicked

The useful version of this project showed up after the fourth meeting, not the first one. The pre-meeting brief did not say "pricing may be a concern." It said Sarah Chen, the CFO, had raised a specific pricing objection earlier, that Michael had defended the ROI, and that the next call should lead with phased pricing.

That was the point where I stopped thinking about transcription as the hard part. I am Saurabh, and the more interesting problem was memory: how to keep the useful parts of a sales conversation without turning the agent into a long-term junk drawer.

## What I Built

Deal Intelligence Agent is a sales intelligence system built with Next.js 16, FastAPI, Supabase, Hindsight, and Groq. In the browser, it records live meeting audio with the MediaRecorder API. The backend uploads the audio, transcribes it with Groq Whisper using `whisper-large-v3`, extracts structured sales intelligence with Groq's `qwen/qwen3-32b`, stores relational state in Supabase, and stores persistent agent memory in Hindsight.

The user flow is intentionally boring: open a deal, record a meeting, wait for processing, then open the next pre-meeting brief.

The architecture is split along access patterns. Supabase stores the facts I want to query exactly: deals, meetings, transcripts, extracted objections, stakeholders, action items, and summary rows. Hindsight stores the memory I want to recall semantically: "what has this deal taught the agent so far?"

That split mattered. A sales meeting produces structured data, but sales strategy is not just structured data. "Sarah is skeptical about Q1 budget" is a row. "Lead with phased pricing because that shifted Sarah from skeptical to neutral after meeting 4" is memory.

The Vectorize post on [what agent memory actually means](https://vectorize.io/what-is-agent-memory) helped. I used [Hindsight GitHub](https://github.com/vectorize-io/hindsight) and the [Hindsight documentation](https://hindsight.vectorize.io/) while wiring this up.

## The Browser Only Captures Audio

I kept the browser responsibility narrow. The frontend records audio and polls processing status. It does not try to transcribe, summarize, chunk, or infer anything locally.

`frontend/components/meetings/MeetingRecorder.tsx` creates a meeting, opens `navigator.mediaDevices.getUserMedia({ audio: true })`, records chunks with `MediaRecorder`, uploads a `Blob`, and then polls `/meetings/{meeting_id}/status`. That status endpoint is not cosmetic. Groq Whisper, extraction, Supabase writes, and Hindsight writes are slow enough that pretending this is a synchronous request would make the app feel broken. The backend exposes the pipeline state as `transcribing`, `extracting`, `storing_memory`, `complete`, or `failed`.

## The Three Memory Types Were The Real Design Decision

I tried to make Hindsight memory boring in the best way: one storage path, three memory types, clear metadata.

The system writes:

1. Episodic memory: what happened in a specific meeting.
2. Semantic memory: patterns across meetings.
3. Procedural memory: strategies that appear to work for this deal.

Those are not three databases. They are three kinds of records in the same Hindsight bank, distinguished by `memory_type` metadata and tagged content. That gave me semantic recall without losing the ability to reconstruct the shape of the deal.

From `backend/services/memory_manager.py`:

```python
async def _store_raw(content: str, metadata: dict) -> Optional[str]:
    """Low-level: store one memory in Hindsight. Returns ID or None on failure."""
    tagged_content = f"[DEAL:{metadata.get('deal_id', 'unknown')}] {content}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_bank_url()}/memories",
                headers=_headers(),
                json={
                    "items": [{"content": tagged_content, "context": str(metadata)}],
                    "async": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("bank_id") or data.get("id") or data.get("memory_id")
    except Exception as e:
        logger.error(f"Hindsight store failed: {e}")
        return None
```

The `[DEAL:{deal_id}]` prefix looks crude, but it solved a real integration problem. Hindsight recall gives me semantically relevant memories. I still need deal-level isolation. The prefix gives recall an obvious anchor, while the metadata gives the application a second way to filter and classify results.

The noisy version of this system would store entire transcripts. I did not want that. The useful version stores compressed, opinionated memories made from extracted intelligence. `store_episodic_memory` decides what the agent is allowed to remember: objections, competitors, stakeholders, action items, and sentiment. Not filler, pleasantries, rambling discovery talk, or every sentence that happened to be transcribed correctly.

## When Memory Should Appear

One thing I like about the implementation is that it refuses to invent patterns too early. After one meeting, the system stores an episodic memory. After two meetings, it can derive semantic memory. After three meetings, it can derive procedural memory.

From `backend/services/pattern_detector.py`:

```python
# 5. Detect patterns if 2+ meetings
if meeting_count >= 2:
    prompt = PATTERN_DETECTION_PROMPT.format(
        company=company,
        meeting_count=meeting_count,
        meeting_data=json.dumps(intel_summary, indent=2),
    )
    patterns = await _call_groq(prompt)

    if patterns:
        await store_semantic_memory(
            deal_id=deal_id,
            company=company,
            patterns=patterns,
            meeting_number=current_meeting_number,
        )

# 6. Store procedural memory if 3+ meetings
if meeting_count >= 3 and patterns:
    await store_procedural_memory(
        deal_id=deal_id,
        company=company,
        strategies=patterns,
        meeting_number=current_meeting_number,
    )
```

This gate is small, but it prevents a lot of nonsense. One meeting can tell you what happened. Two meetings can start to show a pattern. Three meetings can justify "this approach is working" or "this keeps failing." Before that, the agent should be humble.

The same function also updates `deal_memory_summary` in Supabase. That summary is not a replacement for Hindsight. It is a fast relational snapshot for the UI: recurring objections, stakeholders, competitor landscape, sentiment trend, risk level, and winning strategies.

## How The Brief Uses Hindsight

The pre-meeting brief is where the memory work becomes visible. The endpoint does not ask Groq to summarize the database from scratch. It first asks Hindsight for all deal memories, separates them by type, labels them, and gives the model a compact memory context.

From `backend/api/intelligence.py`:

```python
@router.get("/deals/{deal_id}/brief")
async def get_deal_brief(deal_id: str):
    """Generate a pre-meeting brief using accumulated memories."""
    deal_res = supabase.table("deals").select("*").eq("id", deal_id).execute()
    if not deal_res.data:
        raise HTTPException(status_code=404, detail="Deal not found")
    deal = deal_res.data[0]
    company = deal["company"]

    memories = await get_all_deal_memories(deal_id)
    total_count = memories.get("total_count", 0)

    if total_count == 0:
        return {
            "deal_context": "No meetings processed yet.",
            "meeting_history_summary": "No data available.",
            "recurring_risks": [],
            "recommended_strategies": [],
            "stakeholders_to_know": [],
            "competitor_context": "No data available.",
            "confidence": "low",
            "memory_sources": {"episodic_count": 0, "semantic_count": 0, "procedural_count": 0},
        }

    context_parts = []
    for mem in memories.get("episodic", []):
        context_parts.append(f"[EPISODIC MEMORY]\n{mem.get('content', '')}")
    for mem in memories.get("semantic", []):
        context_parts.append(f"[PATTERNS IDENTIFIED]\n{mem.get('content', '')}")
    for mem in memories.get("procedural", []):
        context_parts.append(f"[WINNING STRATEGIES]\n{mem.get('content', '')}")
```

This is the before/after difference.

Without Hindsight, a brief after meeting 4 can only be generic unless I stuff every transcript into the prompt. It might say:

> Pricing has been discussed. Prepare to address budget concerns and explain ROI.

With Hindsight, the brief has memory from the actual deal:

> Sarah Chen, the CFO, first raised enterprise pricing as a Q1 budget blocker in meeting 2. She repeated the objection in meeting 3, saying the price was about 40% over budget. The phased pricing proposal in meeting 4 moved her response from skeptical to neutral. Lead with the phased structure and bring the Salesforce migration cost analysis.

That is not magic. It is the result of storing meeting-level facts as episodic memory, deriving the pricing and stakeholder pattern as semantic memory, and then storing the phased-pricing tactic as procedural memory.

## What Was Painful

The first lesson: transcripts are too noisy to be memory. I trust transcripts as source material, not as memory records. The extractor has to turn speech into a smaller set of sales facts before Hindsight sees it.

The second lesson: memory needs timing. If procedural memory appears after one good meeting, the system sounds confident for the wrong reason. The `meeting_count >= 3` gate made the agent less eager and more useful.

The third lesson: semantic memory and relational summaries are not competitors. Supabase is right for exact UI state. Hindsight is right for recall and compounding context. Using both made the system simpler than trying to force one store to do both jobs.

The fourth lesson: failures need different blast radii. In `backend/api/meetings.py`, the pipeline saves the transcript and extracted intelligence before Hindsight storage. If memory storage fails, it logs the error but still marks the meeting complete. I care about memory, but I care more about not losing a processed meeting because one downstream service had a bad minute.

The fifth lesson: names matter. "Sarah Chen raised pricing" is much more useful than "the customer raised pricing." The extraction prompt asks for stakeholders, roles, sentiment, and influence because the brief becomes dramatically better when memory can talk about people, not just categories.

## The Part I Would Keep

The best part of the system is not Whisper, the LLM call, or the UI. Those are necessary plumbing. The part I would keep is the memory shape.

Episodic memory keeps the agent grounded in what happened. Semantic memory keeps it from treating every meeting as an isolated event. Procedural memory lets it reuse strategies that worked for this specific deal.

That is the difference between an assistant that says "handle pricing objections" and one that says "Sarah Chen already rejected the enterprise price once, softened after phased pricing, and needs the Q1/Q3 split before legal review." Experienced sales reps already think this way. The point of Hindsight in this project was to make the agent remember that way too.
