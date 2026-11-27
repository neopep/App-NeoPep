# NeoPep Connect AI — ferramentas do protótipo local

Arquivo gerado pelo catálogo. Versão `1.0.0-preview.1`. O acesso depende de autorização a cada requisição.
As operações de campanha só aparecem em Teste com adaptador explicitamente configurado.


## get_capabilities

Consultar a versão real publicada, canais, ferramentas habilitadas, limites e operações bloqueadas no ambiente autenticado.

Escopo `campaigns:read`.

```json
{
  "input": {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "properties": {
      "environment": {
        "type": "string",
        "enum": [
          "test",
          "production"
        ]
      },
      "contract_version": {
        "const": "1.0.0-preview.1"
      },
      "enabled_tools": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "restrictions": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "environment",
      "contract_version",
      "enabled_tools",
      "restrictions"
    ],
    "additionalProperties": false
  }
}
```

## get_brand_context

Consultar identidade visual e regras editoriais do NeoPep, sem incluir dados privados.

Escopo `campaigns:read`.

```json
{
  "input": {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "properties": {
      "brand_version": {
        "type": "string"
      },
      "name": {
        "const": "NeoPep"
      },
      "editorial_rules": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "brand_version",
      "name",
      "editorial_rules"
    ],
    "additionalProperties": false
  }
}
```

## list_campaigns

Listar campanhas do titular em Teste nos canais habilitados.

Escopo `campaigns:read`.

```json
{
  "input": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "channel"
    ],
    "properties": {
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50
      },
      "offset": {
        "type": "integer",
        "minimum": 0,
        "maximum": 10000
      },
      "state": {
        "enum": [
          "archived",
          "needs_attention",
          "scheduled",
          "in_progress",
          "draft",
          "unknown"
        ]
      }
    }
  },
  "output": {
    "type": "object",
    "properties": {
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "state": {
              "enum": [
                "archived",
                "needs_attention",
                "scheduled",
                "in_progress",
                "draft",
                "unknown"
              ]
            },
            "channel": {
              "enum": [
                "app",
                "whatsapp"
              ]
            }
          },
          "required": [
            "id",
            "title",
            "state",
            "channel"
          ],
          "additionalProperties": false
        }
      },
      "next_offset": {
        "type": [
          "integer",
          "null"
        ]
      }
    },
    "required": [
      "items",
      "next_offset"
    ],
    "additionalProperties": false
  }
}
```

## get_campaign

Consultar campanha, publicações, agenda resumida e histórico disponível em Teste.

Escopo `campaigns:read`.

```json
{
  "input": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "channel",
      "campaign_id"
    ],
    "properties": {
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50
      },
      "offset": {
        "type": "integer",
        "minimum": 0,
        "maximum": 10000
      },
      "campaign_id": {
        "type": "string",
        "format": "uuid"
      },
      "include_recurrences": {
        "type": "boolean"
      }
    }
  },
  "output": {
    "type": "object",
    "properties": {
      "campaign": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "title": {
            "type": "string"
          },
          "state": {
            "enum": [
              "archived",
              "needs_attention",
              "scheduled",
              "in_progress",
              "draft",
              "unknown"
            ]
          },
          "channel": {
            "enum": [
              "app",
              "whatsapp"
            ]
          }
        },
        "required": [
          "id",
          "title",
          "state",
          "channel"
        ],
        "additionalProperties": false
      },
      "publications": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "revision": {
              "type": [
                "integer",
                "null"
              ]
            },
            "schedules": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "due_at": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "cancelled_at": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "states": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                },
                "required": [
                  "due_at",
                  "cancelled_at",
                  "states"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "id",
            "title",
            "revision",
            "schedules"
          ],
          "additionalProperties": false
        }
      },
      "next_offset": {
        "type": [
          "integer",
          "null"
        ]
      },
      "history": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "event": {
              "type": "string"
            },
            "recorded_at": {
              "type": [
                "string",
                "null"
              ]
            }
          },
          "required": [
            "event",
            "recorded_at"
          ],
          "additionalProperties": false
        }
      },
      "recurrences": {
        "type": [
          "array",
          "null"
        ],
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "state": {
              "type": "string"
            },
            "dates": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "id",
            "state",
            "dates"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "campaign",
      "publications",
      "next_offset",
      "history",
      "recurrences"
    ],
    "additionalProperties": false
  }
}
```

