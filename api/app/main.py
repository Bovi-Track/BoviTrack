# para correr el api: uv run fastapi dev app/main.py
from fastapi import FastAPI

app = FastAPI(
    title="BoviTrack API",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {"message": "BoviTrack API"}


@app.get("/health")
async def health():
    return {"status": "ok"}
