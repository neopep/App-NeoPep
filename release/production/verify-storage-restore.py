#!/usr/bin/env python3
"""Verify private Storage restore bytes against a separately authorized source manifest.

Offline only: no network, no Supabase credentials, no uploads. Never commit manifests
or backup objects. The source manifest's provenance and freeze time require human proof.
"""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import tempfile


class VerificationError(Exception):
    pass


def fail(message):
    raise VerificationError(message)


def check(manifest_path, restore_root, expected_counts_path):
    root = Path(restore_root)
    if not root.is_dir():
        fail("O diretório de restauração não existe.")
    root = root.resolve(strict=True)
    manifest_file = Path(manifest_path)
    counts_file = Path(expected_counts_path)
    if not manifest_file.is_file() or not counts_file.is_file():
        fail("Manifesto de origem e contagens verificadas são obrigatórios.")
    try:
        counts = json.loads(counts_file.read_text(encoding="utf-8"))
    except (ValueError, UnicodeError) as exc:
        fail("Contagens de origem inválidas: " + type(exc).__name__)
    if not isinstance(counts, dict) or not counts:
        fail("A lista de buckets de origem deve ser um objeto JSON não vazio.")
    if any(not isinstance(k, str) or not re.fullmatch(r"[a-zA-Z0-9_-]+", k)
           or type(v) is not int or v < 0 for k, v in counts.items()):
        fail("Contagens ou identificadores de buckets inválidos.")
    seen = set()
    actual = {bucket: 0 for bucket in counts}
    total_bytes = 0
    with manifest_file.open("r", encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except ValueError:
                fail(f"Manifesto contém JSON inválido no item {index}.")
            if not isinstance(item, dict):
                fail(f"Item {index}: tipo incorreto.")
            bucket, key = item.get("bucket"), item.get("key")
            size, expected_hash = item.get("size"), item.get("sha256")
            if bucket not in counts or not isinstance(key, str) or not key:
                fail(f"Item {index}: bucket ou chave fora do inventário.")
            parts = key.split("/")
            if key.startswith("/") or "\\" in key or any(p in ("", ".", "..") for p in parts):
                fail(f"Item {index}: caminho inseguro.")
            if type(size) is not int or size < 0:
                fail(f"Item {index}: tamanho inválido.")
            if not isinstance(expected_hash, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", expected_hash):
                fail(f"Item {index}: SHA-256 inválido.")
            if (bucket, key) in seen:
                fail(f"Item {index}: objeto repetido.")
            seen.add((bucket, key))
            local = root / bucket
            for part in parts:
                if local.is_symlink():
                    fail(f"Item {index}: link simbólico proibido.")
                local = local / part
            if local.is_symlink() or not local.is_file() or not local.resolve().is_relative_to(root):
                fail(f"Item {index}: objeto ausente ou caminho fora do diretório.")
            if local.stat().st_size != size:
                fail(f"Item {index}: tamanho divergente.")
            digest = hashlib.sha256()
            with local.open("rb") as restored:
                for chunk in iter(lambda: restored.read(1024 * 1024), b""):
                    digest.update(chunk)
            if digest.hexdigest().lower() != expected_hash.lower():
                fail(f"Item {index}: conteúdo SHA-256 divergente.")
            actual[bucket] += 1
            total_bytes += size
    if not seen:
        fail("Manifesto vazio: nenhuma integridade comprovada.")
    for bucket in sorted(counts):
        if actual[bucket] != counts[bucket]:
            fail("Cobertura incompleta do inventário de objetos restaurados.")
    return {"verified": True, "objects": len(seen), "buckets": len(counts),
            "bytes": total_bytes, "note": "Não comprova autenticidade ou origem temporal do manifesto."}


def self_test():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "neo-library").mkdir()
        path = root / "neo-library" / "hello.bin"
        path.write_bytes(b"NeoPep restore verification")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        manifest = root / "manifest.jsonl"
        counts = root / "counts.json"
        counts.write_text('{"neo-library":1}', encoding="utf-8")
        row = {"bucket": "neo-library", "key": "hello.bin", "size": path.stat().st_size,
               "sha256": digest}
        manifest.write_text(json.dumps(row) + "\n", encoding="utf-8")
        assert check(manifest, root, counts)["objects"] == 1
        for changed in ({**row, "sha256": "0" * 64},
                        {**row, "key": "../hello.bin"},
                        {**row, "size": row["size"] + 1}):
            manifest.write_text(json.dumps(changed) + "\n", encoding="utf-8")
            try:
                check(manifest, root, counts)
            except VerificationError:
                pass
            else:
                raise AssertionError("Inconsistência não detectada.")
        manifest.write_text(json.dumps(row) + "\n" + json.dumps(row) + "\n",
                            encoding="utf-8")
        try:
            check(manifest, root, counts)
        except VerificationError:
            pass
        else:
            raise AssertionError("Duplicação não detectada.")
    return "Autoteste local de integridade aprovado (positivo e casos negativos)."


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--manifest", help="JSONL de inventário autorizado, mantido fora do Git")
    parser.add_argument("--root", help="Raiz local dos objetos restaurados, com subpastas por bucket")
    parser.add_argument("--expected-counts", help="JSON de contagens por bucket no mesmo ponto lógico")
    args = parser.parse_args()
    try:
        if args.self_test:
            print(self_test())
            return 0
        if not all((args.manifest, args.root, args.expected_counts)):
            parser.error("São obrigatórios --manifest, --root e --expected-counts.")
        print(json.dumps(check(args.manifest, args.root, args.expected_counts),
                         ensure_ascii=False, sort_keys=True))
        return 0
    except VerificationError as exc:
        print("FALHA: " + str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
