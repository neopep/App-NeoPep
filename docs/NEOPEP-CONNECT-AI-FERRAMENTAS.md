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

Listar a primeira página de campanhas WhatsApp do titular em Teste.

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
        "const": "whatsapp"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50
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
                "active",
                "archived"
              ]
            },
            "channel": {
              "const": "whatsapp"
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
      }
    },
    "required": [
      "items"
    ],
    "additionalProperties": false
  }
}
```

## get_campaign

Consultar uma campanha WhatsApp do titular em Teste e o resumo das suas publicações.

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
        "const": "whatsapp"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50
      },
      "campaign_id": {
        "type": "string",
        "format": "uuid"
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
              "active",
              "archived"
            ]
          },
          "channel": {
            "const": "whatsapp"
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
            }
          },
          "required": [
            "id",
            "title",
            "revision"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "campaign",
      "publications"
    ],
    "additionalProperties": false
  }
}
```

