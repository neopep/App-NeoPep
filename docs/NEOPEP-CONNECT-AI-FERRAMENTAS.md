# NeoPep Connect AI — ferramentas do protótipo local

Arquivo gerado pelo catálogo. Versão `1.0.0-preview.1`. O acesso depende de autorização a cada requisição.

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

