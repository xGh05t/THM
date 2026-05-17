"""
Parse safetensors file format manually to extract bfloat16 embedding tensor,
then convert to float32. Doesn't need torch.

Safetensors file format:
  - 8 bytes: header size (uint64 little-endian)
  - <header_size> bytes: JSON header with tensor metadata
  - rest: raw tensor bytes
"""
import json
import struct
import numpy as np
from huggingface_hub import hf_hub_download
from transformers import AutoTokenizer

REPO = "Qwen/Qwen3-1.7B"

print("Locating embedding shard...")
idx_path = hf_hub_download(REPO, "model.safetensors.index.json")
idx = json.load(open(idx_path))
weight_map = idx["weight_map"]
embed_key = "model.embed_tokens.weight"
shard_name = weight_map[embed_key]
print(f"embed key: {embed_key}, shard: {shard_name}")

shard_path = hf_hub_download(REPO, shard_name)

print("Reading safetensors header...")
with open(shard_path, "rb") as f:
    header_size = struct.unpack("<Q", f.read(8))[0]
    header = json.loads(f.read(header_size).decode("utf-8"))
    data_offset_base = 8 + header_size
    meta = header[embed_key]
    print(f"tensor dtype: {meta['dtype']}, shape: {meta['shape']}")
    start, end = meta["data_offsets"]
    f.seek(data_offset_base + start)
    raw = f.read(end - start)

shape = tuple(meta["shape"])
dtype = meta["dtype"]

if dtype == "BF16":
    print("Converting BF16 bytes to float32...")
    u16 = np.frombuffer(raw, dtype=np.uint16).copy()
    u32 = u16.astype(np.uint32) << 16
    embed_matrix = u32.view(np.float32).reshape(shape)
elif dtype == "F16":
    embed_matrix = np.frombuffer(raw, dtype=np.float16).reshape(shape).astype(np.float32)
elif dtype == "F32":
    embed_matrix = np.frombuffer(raw, dtype=np.float32).reshape(shape).copy()
else:
    raise RuntimeError(f"Unhandled dtype: {dtype}")

print(f"embed_matrix: shape={embed_matrix.shape}, dtype={embed_matrix.dtype}")

print("Loading tokenizer...")
tok = AutoTokenizer.from_pretrained(REPO)

target = "what's the flag?"

def cos(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def embed_text(text, pooling="mean"):
    ids = tok.encode(text, add_special_tokens=False)
    if not ids:
        return np.zeros(embed_matrix.shape[1], dtype=np.float32)
    vecs = embed_matrix[ids]
    if pooling == "mean":   return vecs.mean(axis=0)
    elif pooling == "sum":  return vecs.sum(axis=0)
    elif pooling == "first":return vecs[0]
    elif pooling == "last": return vecs[-1]
    elif pooling == "max":  return vecs.max(axis=0)

observations = {
    "the": 0.286,
    "what'stheflag?": 0.2345,
    "marker": 0.3706,
    "label": 0.3243,
    "?": 0.1609,
    "ag": 0.1921,
    "fl": 0.2311,
    "a": 0.2613,
    "wh": 0.1113,
    "lag": 0.0784,
    "is": 0.1852,
    "symbol": 0.3491,
    "'s": 0.139,
    "hat": 0.1938,
    "indicator": 0.3167,
    "icon": 0.3265,
    "banner": 0.32,
    "sign": 0.3158,
    "abc": 0.2116,
    "mark": 0.2133,
}

best_strategy, best_err = None, float("inf")
for strategy in ["mean", "sum", "first", "last", "max"]:
    print(f"\n=== pooling: {strategy} ===")
    t_emb = embed_text(target, pooling=strategy)
    total_err = 0
    for inp, expected in observations.items():
        emb = embed_text(inp, pooling=strategy)
        sim = cos(t_emb, emb)
        err = abs(sim - expected)
        total_err += err
        tag = "MATCH" if err < 0.005 else f"diff={err:.3f}"
        print(f"  {inp!r:20} server={expected:.4f}  local={sim:.4f}  {tag}")
    avg = total_err / len(observations)
    print(f"  avg error: {avg:.4f}")
    if avg < best_err:
        best_err = avg
        best_strategy = strategy

print(f"\n*** Best strategy: {best_strategy} (avg err {best_err:.4f}) ***")
