# NeoPep Connect AI — catálogo candidato de ferramentas

Arquivo gerado pelo catálogo. Versão `1.0.0-preview.4`. O acesso depende de autorização a cada requisição.
O guia inclui métodos criativos próprios; referências externas não são executadas nem copiadas. Antes de preparar campanhas, consulte get_capabilities, get_publication_guide e get_brand_context. A escrita candidata exige guideVersion atual e guideReceipt assinado, válido por 10 minutos e vinculado à conexão. Comprova consulta técnica, não compreensão pelo modelo. O catálogo descreve o código candidato, não a implantação ativa. O acesso depende do ambiente e das capacidades publicadas. As ferramentas de escrita são candidatas exclusivas de Teste e exigem consentimento campaigns:drafts; não estão implantadas.


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
        "const": "1.0.0-preview.4"
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

## get_publication_guide

Consultar primeiro, antes de preparar publicações: instruções operacionais atualizadas, exemplos de blocos e legendas, limites e disponibilidade por conexão. Somente leitura.

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
      "guide_version": {
        "const": "2026-11-27.7"
      },
      "guide_receipt": {
        "type": [
          "string",
          "null"
        ],
        "description": "Comprovante temporário da consulta, exigido para escrita; não autoriza envio."
      },
      "environment": {
        "enum": [
          "test",
          "production"
        ]
      },
      "available_tools": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "workflow": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "native_editor": {
        "type": "object",
        "properties": {
          "timezone": {
            "const": "America/Sao_Paulo"
          },
          "block_types": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "whatsapp_blocks": {
            "const": 6
          },
          "draft_blocks": {
            "const": 32
          },
          "text_limit": {
            "const": 2000
          },
          "caption_limit": {
            "const": 1000
          },
          "link_caption_limit": {
            "const": 160
          },
          "conservative_image_limit_bytes": {
            "const": 1048576
          },
          "image_target_bytes": {
            "const": 5242880
          },
          "original_file_limit_bytes": {
            "const": 5242880
          },
          "group_limit": {
            "const": 30
          },
          "caption_modes": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "formatting": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "app_controls": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "timezone",
          "block_types",
          "whatsapp_blocks",
          "draft_blocks",
          "text_limit",
          "caption_limit",
          "link_caption_limit",
          "conservative_image_limit_bytes",
          "image_target_bytes",
          "original_file_limit_bytes",
          "group_limit",
          "caption_modes",
          "formatting",
          "app_controls"
        ],
        "additionalProperties": false
      },
      "examples": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "blocks": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": {
                    "enum": [
                      "image",
                      "file",
                      "text"
                    ]
                  },
                  "text": {
                    "type": "string"
                  },
                  "layout": {
                    "enum": [
                      "caption",
                      "separate",
                      "not_applicable"
                    ]
                  }
                },
                "required": [
                  "type",
                  "text",
                  "layout"
                ],
                "additionalProperties": false
              }
            }
          },
          "required": [
            "name",
            "blocks"
          ],
          "additionalProperties": false
        }
      },
      "creative_context": {
        "type": "object",
        "properties": {
          "version": {
            "type": "string"
          },
          "methods": {
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
                "instructions": {
                  "type": "string"
                },
                "deliverable": {
                  "type": "string"
                }
              },
              "required": [
                "id",
                "title",
                "instructions",
                "deliverable"
              ],
              "additionalProperties": false
            }
          },
          "policy": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "version",
          "methods",
          "policy"
        ],
        "additionalProperties": false
      },
      "operations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string"
            },
            "requires": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "available": {
              "type": "boolean"
            },
            "rules": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "name",
            "requires",
            "available",
            "rules"
          ],
          "additionalProperties": false
        }
      },
      "guardrails": {
        "type": "array",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "guide_version",
      "guide_receipt",
      "environment",
      "available_tools",
      "workflow",
      "native_editor",
      "examples",
      "creative_context",
      "operations",
      "guardrails"
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
            "album_id": {
              "type": "string",
              "format": "uuid"
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

## create_campaign_draft

Cria campanha em rascunho exclusivamente no Teste. Não envia nem agenda. Reutilize requestId em tentativas.

Escopo `campaigns:read + campaigns:drafts`.

```json
{
  "input": {
    "type": "object",
    "properties": {
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "title": {
        "type": "string",
        "minLength": 1,
        "maxLength": 120
      },
      "requestId": {
        "type": "string",
        "format": "uuid"
      },
      "guideVersion": {
        "type": "string",
        "const": "2026-11-27.7",
        "description": "Versão retornada por get_publication_guide; consulte antes de escrever."
      },
      "guideReceipt": {
        "type": "string",
        "maxLength": 78,
        "description": "Comprovante temporário guide_receipt de get_publication_guide, vinculado à conexão."
      }
    },
    "required": [
      "channel",
      "title",
      "requestId",
      "guideVersion",
      "guideReceipt"
    ],
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "properties": {
      "campaignId": {
        "type": "string",
        "format": "uuid"
      },
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "status": {
        "const": "draft_created_or_reused"
      }
    },
    "required": [
      "campaignId",
      "channel",
      "status"
    ],
    "additionalProperties": false
  }
}
```

## add_publications

Adiciona até seis publicações textuais em rascunho. plannedLocal é sugestão de horário, não agenda. Retorna resultado individual; reutilize IDs em tentativas.

Escopo `campaigns:read + campaigns:drafts`.

```json
{
  "input": {
    "type": "object",
    "properties": {
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "campaignId": {
        "type": "string",
        "format": "uuid"
      },
      "guideVersion": {
        "type": "string",
        "const": "2026-11-27.7",
        "description": "Versão retornada por get_publication_guide; consulte antes de escrever."
      },
      "guideReceipt": {
        "type": "string",
        "maxLength": 78,
        "description": "Comprovante temporário guide_receipt de get_publication_guide, vinculado à conexão."
      },
      "items": {
        "type": "array",
        "minItems": 1,
        "maxItems": 6,
        "items": {
          "type": "object",
          "properties": {
            "publicationId": {
              "type": "string",
              "format": "uuid"
            },
            "requestId": {
              "type": "string",
              "format": "uuid"
            },
            "title": {
              "type": "string",
              "minLength": 1,
              "maxLength": 120
            },
            "blocks": {
              "type": "array",
              "minItems": 1,
              "maxItems": 6,
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "text": {
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 2000
                  }
                },
                "required": [
                  "id",
                  "text"
                ],
                "additionalProperties": false
              }
            },
            "plannedLocal": {
              "type": "string",
              "maxLength": 16
            }
          },
          "required": [
            "publicationId",
            "requestId",
            "title",
            "blocks"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "channel",
      "campaignId",
      "guideVersion",
      "guideReceipt",
      "items"
    ],
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "properties": {
      "campaignId": {
        "type": "string",
        "format": "uuid"
      },
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "publicationId": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "enum": [
                "draft_saved_or_reused",
                "not_confirmed"
              ]
            },
            "revision": {
              "type": "integer"
            },
            "error": {
              "type": "string"
            }
          },
          "required": [
            "publicationId",
            "status"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "campaignId",
      "channel",
      "results"
    ],
    "additionalProperties": false
  }
}
```

## update_publications

Edita texto ou, no WhatsApp, mantém legenda, remove legenda ou cria mensagem de texto separada em rascunho. Exige revisão atual e ID de bloco; preserva outros campos. Conflitos exigem nova leitura.

Escopo `campaigns:read + campaigns:drafts`.

```json
{
  "input": {
    "type": "object",
    "properties": {
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "campaignId": {
        "type": "string",
        "format": "uuid"
      },
      "guideVersion": {
        "type": "string",
        "const": "2026-11-27.7",
        "description": "Versão retornada por get_publication_guide; consulte antes de escrever."
      },
      "guideReceipt": {
        "type": "string",
        "maxLength": 78,
        "description": "Comprovante temporário guide_receipt de get_publication_guide, vinculado à conexão."
      },
      "items": {
        "type": "array",
        "minItems": 1,
        "maxItems": 6,
        "items": {
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "publicationId": {
                  "type": "string",
                  "format": "uuid"
                },
                "requestId": {
                  "type": "string",
                  "format": "uuid"
                },
                "revision": {
                  "type": "integer",
                  "minimum": 1
                },
                "edits": {
                  "type": "array",
                  "minItems": 1,
                  "maxItems": 6,
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "text": {
                        "type": "string",
                        "minLength": 1,
                        "maxLength": 2000
                      }
                    },
                    "required": [
                      "id",
                      "text"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "publicationId",
                "requestId",
                "revision",
                "edits"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "publicationId": {
                  "type": "string",
                  "format": "uuid"
                },
                "requestId": {
                  "type": "string",
                  "format": "uuid"
                },
                "revision": {
                  "type": "integer",
                  "minimum": 1
                },
                "mediaCaption": {
                  "type": "object",
                  "properties": {
                    "blockId": {
                      "type": "string",
                      "format": "uuid"
                    },
                    "mode": {
                      "enum": [
                        "caption",
                        "separate",
                        "none"
                      ]
                    },
                    "text": {
                      "type": "string",
                      "maxLength": 2000
                    },
                    "separateBlockId": {
                      "type": "string",
                      "format": "uuid"
                    }
                  },
                  "required": [
                    "blockId",
                    "mode"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "publicationId",
                "requestId",
                "revision",
                "mediaCaption"
              ],
              "additionalProperties": false
            },
            {
              "type": "object",
              "properties": {
                "publicationId": {
                  "type": "string",
                  "format": "uuid"
                },
                "requestId": {
                  "type": "string",
                  "format": "uuid"
                },
                "revision": {
                  "type": "integer",
                  "minimum": 1
                },
                "albumEdit": {
                  "type": "object",
                  "properties": {
                    "albumId": {
                      "type": "string",
                      "format": "uuid"
                    },
                    "items": {
                      "type": "array",
                      "minItems": 2,
                      "maxItems": 4,
                      "items": {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string",
                            "format": "uuid"
                          },
                          "text": {
                            "type": "string",
                            "maxLength": 1000
                          }
                        },
                        "required": [
                          "id",
                          "text"
                        ],
                        "additionalProperties": false
                      }
                    }
                  },
                  "required": [
                    "albumId",
                    "items"
                  ],
                  "additionalProperties": false
                }
              },
              "required": [
                "publicationId",
                "requestId",
                "revision",
                "albumEdit"
              ],
              "additionalProperties": false
            }
          ]
        }
      }
    },
    "required": [
      "channel",
      "campaignId",
      "guideVersion",
      "guideReceipt",
      "items"
    ],
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "properties": {
      "campaignId": {
        "type": "string",
        "format": "uuid"
      },
      "channel": {
        "enum": [
          "app",
          "whatsapp"
        ]
      },
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "publicationId": {
              "type": "string",
              "format": "uuid"
            },
            "status": {
              "enum": [
                "draft_saved_or_reused",
                "not_confirmed"
              ]
            },
            "revision": {
              "type": "integer"
            },
            "error": {
              "type": "string"
            }
          },
          "required": [
            "publicationId",
            "status"
          ],
          "additionalProperties": false
        }
      }
    },
    "required": [
      "campaignId",
      "channel",
      "results"
    ],
    "additionalProperties": false
  }
}
```

