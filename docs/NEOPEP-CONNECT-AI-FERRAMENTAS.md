# NeoPep Connect AI — catálogo candidato de ferramentas

Arquivo gerado pelo catálogo. Versão `1.0.0-preview.2`. O acesso depende de autorização a cada requisição.
O catálogo descreve o código candidato, não a implantação ativa. O acesso depende do ambiente e das capacidades publicadas. Escrita de rascunhos permanece fora do catálogo ativo.


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
        "const": "1.0.0-preview.2"
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

Listar campanhas do titular no ambiente conectado, incluindo estado e próximo horário disponível.

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
          "paused",
          "needs_attention",
          "scheduled",
          "in_progress",
          "draft",
          "active",
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
                "paused",
                "needs_attention",
                "scheduled",
                "in_progress",
                "draft",
                "active",
                "unknown"
              ]
            },
            "channel": {
              "enum": [
                "app",
                "whatsapp"
              ]
            },
            "next_at": {
              "type": [
                "string",
                "null"
              ]
            },
            "archived_at": {
              "type": [
                "string",
                "null"
              ]
            },
            "paused_at": {
              "type": [
                "string",
                "null"
              ]
            }
          },
          "required": [
            "id",
            "title",
            "state",
            "channel",
            "next_at",
            "archived_at",
            "paused_at"
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

Consultar campanha, publicações, grupos conhecidos, datas de configuração e envio e histórico. Use include_recurrences=true para consultar recorrências. accepted_with_receipt indica aceite com recibo do executor, não comprova entrega ou leitura no WhatsApp.

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
              "paused",
              "needs_attention",
              "scheduled",
              "in_progress",
              "draft",
              "active",
              "unknown"
            ]
          },
          "channel": {
            "enum": [
              "app",
              "whatsapp"
            ]
          },
          "next_at": {
            "type": [
              "string",
              "null"
            ]
          },
          "archived_at": {
            "type": [
              "string",
              "null"
            ]
          },
          "paused_at": {
            "type": [
              "string",
              "null"
            ]
          }
        },
        "required": [
          "id",
          "title",
          "state",
          "channel",
          "next_at",
          "archived_at",
          "paused_at"
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
                  },
                  "configured_at": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "sent_at": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "origin": {
                    "type": [
                      "string",
                      "null"
                    ]
                  },
                  "delivery_status": {
                    "enum": [
                      "unknown",
                      "cancelled",
                      "queued",
                      "scheduled",
                      "in_progress",
                      "needs_attention",
                      "partially_accepted",
                      "accepted",
                      "accepted_with_receipt",
                      "displayed",
                      "ended_or_cancelled",
                      "available_in_app"
                    ]
                  },
                  "message_count": {
                    "type": [
                      "integer",
                      "null"
                    ]
                  },
                  "receipt_count": {
                    "type": [
                      "integer",
                      "null"
                    ]
                  },
                  "group_count": {
                    "type": [
                      "integer",
                      "null"
                    ]
                  },
                  "group_names": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                },
                "required": [
                  "due_at",
                  "cancelled_at",
                  "states",
                  "configured_at",
                  "sent_at",
                  "origin",
                  "delivery_status",
                  "message_count",
                  "receipt_count",
                  "group_count",
                  "group_names"
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
            "configured_at": {
              "type": [
                "string",
                "null"
              ]
            },
            "timezone": {
              "type": [
                "string",
                "null"
              ]
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
            "configured_at",
            "timezone",
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

## get_publication_content

Ler conteúdo editorial e revisão da publicação do titular. Retorna texto, rótulos e tipos, não caminhos de mídia ou URLs privadas. Depende do gate de exclusão nativo.

Escopo `campaigns:read`.

```json
{
  "input": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "channel",
      "campaign_id",
      "publication_id"
    ],
    "properties": {
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "campaign_id": {
        "type": "string",
        "format": "uuid"
      },
      "publication_id": {
        "type": "string",
        "format": "uuid"
      }
    }
  },
  "output": {
    "type": "object",
    "properties": {
      "campaign_id": {
        "type": "string"
      },
      "publication_id": {
        "type": "string"
      },
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "revision": {
        "type": "integer"
      },
      "title": {
        "type": "string"
      },
      "planned_local": {
        "type": [
          "string",
          "null"
        ]
      },
      "timezone": {
        "type": [
          "string",
          "null"
        ]
      },
      "editable_draft": {
        "type": "boolean"
      },
      "blocks": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "type": {
              "enum": [
                "text",
                "image",
                "file",
                "link",
                "product",
                "document",
                "community"
              ]
            },
            "text": {
              "type": [
                "string",
                "null"
              ]
            },
            "label": {
              "type": [
                "string",
                "null"
              ]
            },
            "name": {
              "type": [
                "string",
                "null"
              ]
            },
            "has_attachment": {
              "type": "boolean"
            },
            "has_link": {
              "type": "boolean"
            }
          },
          "required": [
            "id",
            "type",
            "text",
            "label",
            "name",
            "has_attachment",
            "has_link"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "campaign_id",
      "publication_id",
      "channel",
      "revision",
      "title",
      "planned_local",
      "timezone",
      "editable_draft",
      "blocks"
    ],
    "additionalProperties": false
  }
}
```

## list_authorized_assets

Consultar catálogo autorizado do editor (Loja, Biblioteca e Comunidade), até 30 referências. Não retorna fotos, conteúdo dos membros, preço, credenciais ou arquivos privados. Nenhuma vinculação é realizada.

Escopo `campaigns:read`.

```json
{
  "input": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "channel",
      "kind"
    ],
    "properties": {
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "kind": {
        "enum": [
          "product",
          "document",
          "community"
        ]
      },
      "search": {
        "type": "string",
        "maxLength": 100
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
            "label": {
              "type": "string"
            },
            "kind": {
              "enum": [
                "product",
                "document",
                "community"
              ]
            }
          },
          "required": [
            "id",
            "label",
            "kind"
          ],
          "additionalProperties": false
        }
      },
      "limit": {
        "const": 30
      }
    },
    "required": [
      "items",
      "limit"
    ],
    "additionalProperties": false
  }
}
```

## list_destinations

Consultar nomes e disponibilidade de grupos WhatsApp da conexão vigente do administrador. Não retorna JID, contatos, telefones ou membros; seleção e envio não são realizados.

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
          "whatsapp"
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
            "name": {
              "type": "string"
            },
            "state": {
              "enum": [
                "eligible",
                "stale"
              ]
            }
          },
          "required": [
            "name",
            "state"
          ],
          "additionalProperties": false
        }
      },
      "selection_limit": {
        "const": 30
      }
    },
    "required": [
      "items",
      "selection_limit"
    ],
    "additionalProperties": false
  }
}
```

