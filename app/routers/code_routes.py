from fastapi import APIRouter, HTTPException
from jinja2 import Template

import json
import pathlib
import aiofiles

from app.schemas.submission import SubmissionRequest, Submission
from app.redis_client import (
    get_async_redis_client, 
)

from app.config import settings

router = APIRouter(
    prefix="/api-v1/code",
    tags=["code"]
)

redis_client = get_async_redis_client()
PARENT_DIR = pathlib.Path(__file__).parent.parent


# @router.post("/submit")
# async def submit_code(submission_request: SubmissionRequest):
#     # reads the source_code using the problem_id and language from the problems directory and appends it to the user_code.
#     try:
#         async with aiofiles.open(f"{PARENT_DIR}/problems/{submission_request.problem_id}/{submission_request.language}/Main.j2", 'r') as f:
#             main_code = await f.read()
#     except FileNotFoundError:
#         raise HTTPException(status_code=404, detail="Problem or language not found.")

#     template = Template(main_code)
#     full_code = template.render(user_code=submission_request.user_code)

#     # stringify the submission data and store it in Redis
#     data_in_json = submission_request.model_dump_json(exclude={"user_code"})

#     data_to_store = {
#         "submission_id": submission_request.submission_id,
#         "problem_id": submission_request.problem_id,
#         "language": submission_request.language,
#         "test_cases": json.dumps([test_case.model_dump() for test_case in submission_request.test_cases]),
#         "status": "queued",
#         "output": "",
#         "error": "",
#         "results": json.dumps([]),
#         "time_taken": 0.0,
#     }

#     try:
#         await redis_client.hset(
#             f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission_request.submission_id}",
#             mapping=data_to_store
#         )
#         # add job to redis queue
#         await redis_client.lpush(settings.REDIS_QUEUE_NAME, data_in_json)

#     except Exception:
#         raise HTTPException(status_code=500, detail="server error storing submission data in Redis.")
    
#     try:
#         pathlib.Path(f"{PARENT_DIR}/code/{submission_request.submission_id}").mkdir(parents=True, exist_ok=True)
#     except Exception as e:
#         raise HTTPException(status_code=500, detail="server error creating code directory.")

#     async with aiofiles.open(f"{PARENT_DIR}/code/{submission_request.submission_id}/Main.cpp", 'w') as f:
#         await f.write(full_code)

#     return {
#         "message": "Submission received successfully.",
#         "submission": submission_request.model_dump(exclude={"user_code", "test_cases"})
#     }
language_extension = {
    'python':"py",
    'java':'java',
    'cpp':'cpp',
    'c':'c',
}

@router.post("/submit")
async def submit_code(submission: Submission):
    full_code = Template(submission.main_code).render(user_code = submission.user_code)
    # stringify the submission data and store it in Redis
    data_in_json = submission.model_dump_json(exclude={"user_code","main_code"})

    data_to_store = {
        "submission_id": submission.submission_id,
        "language": submission.language,
        "test_cases": json.dumps([test_case.model_dump() for test_case in submission.test_cases]),
        "status": "queued",
        "output": "",
        "error": "",
        "results": json.dumps([]),
        "time_taken": 0.0,
    }

    # create the dir and add the code for execution by worker
    try:
        pathlib.Path(f"{PARENT_DIR}/code/{submission.submission_id}").mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail="server error creating code directory.")
    
    dir_path = f"{PARENT_DIR}/code/{submission.submission_id}/Main.{language_extension[submission.language]}"
    async with aiofiles.open(dir_path, 'w') as f:
            await f.write(full_code)
    try:
        await redis_client.hset(
            f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission.submission_id}",
            mapping=data_to_store
        )
        await redis_client.expire(f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission.submission_id}",1800)
        # add job to redis queue
        await redis_client.lpush(settings.REDIS_QUEUE_NAME, data_in_json)

    except Exception:
        raise HTTPException(status_code=500, detail="server error storing submission data in Redis.")
    
    return {
        "message": "Submission received successfully.",
        "submission": submission.model_dump(exclude={"user_code", "test_cases"})
    }

@router.get("/submission/poll/{submission_id}")
async def poll_submission(submission_id: str):
    submission_key = f"{settings.REDIS_SUBMISSION_KEY_PREFIX}{submission_id}"
    submission_data = await redis_client.hgetall(submission_key)

    if not submission_data:
        return {"error": "Submission not found."}

    return submission_data

