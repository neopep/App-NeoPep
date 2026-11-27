# Candidate only. Operator supplies a reviewed Debian base pinned by digest.
ARG BASE_IMAGE
FROM ${BASE_IMAGE}
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pil python3-pypdf ffmpeg clamav && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/neo
COPY validator.py scan_entry.py ./
USER 65532:65532
ENTRYPOINT ["/usr/bin/python3","/opt/neo/scan_entry.py"]
