# Calculadora de volume

A interface usa a função existente `NeoCore.convertDose` para concentração, volume e graduação volumétrica U-100. O máximo de dose que o slider pode representar vem de concentração × capacidade da seringa. O slider usa a última posição discreta que não ultrapassa esse limite. Entradas manuais e atalhos mantêm o valor informado, inclusive se exceder a capacidade. O resultado sinaliza excedentes e valores entre marcas, e usa ≈ quando precisa aproximar a exibição.

## Escala de referência

A ilustração usa três configurações de escala padrão U-100. A capacidade define o comprimento do cilindro e a menor divisão define as posições possíveis do êmbolo no desenho.

| Capacidade | Faixa na escala | Menor divisão ilustrada |
|---|---:|---:|
| 0,3 mL | 0–30 | 1 |
| 0,5 mL | 0–50 | 1 |
| 1 mL | 0–100 | 2 |

O desenho limita a indicação visual à marca inferior quando o resultado está entre duas marcas. O resultado numérico indica o volume calculado separadamente. A família de referência é [BD Ultra-Fine U-100](https://www.bd.com/en-us/products-and-solutions/products/product-families/bd-ultra-fine-insulin-syringes), que também tem variantes com outras graduações. A rede desta sessão bloqueou a consulta direta à ficha do fabricante. A correspondência por SKU deve ser conferida na homologação, e a interface orienta conferir a graduação do modelo real. U-100 é tratada apenas como relação de volume. O aplicativo não determina se a dose informada é prescrita ou segura.

## Verificação local

`npm run build`, `npm run check` e `node --test tests/{ui,core,pwa}.test.cjs` verificam o bundle, a conversão, a integração da interface, a precisão e a escala. `node tests/calculator-browser.cjs` executa o cenário visual em Chromium desktop e emulação de iPhone 13, incluindo teclado, extremos dos sliders, capacidade, entrada manual e responsividade.

## Acabamento vetorial 3D

Os frascos usam gradientes finos, recorte do compartimento interno e reflexos sobre o líquido. O menisco acompanha o mesmo contêiner cujo `y` e `height` já são atualizados pelos controles. As seringas usam o mesmo desenho vetorial nos três cards e no resultado. Os cards mostram marcas principais decorativas. A seringa principal conserva toda a graduação e posiciona a frente do êmbolo e o limite do líquido nas coordenadas já calculadas.

O ensaio compara estados equivalentes antes e depois em Chromium desktop e na emulação do iPhone 13. O cenário foi repetido numa emulação Pixel 7. Também verifica três cards acessíveis por rádio, encaixe dos cards na mesma linha, IDs e referências locais dos SVGs, nível do frasco e coincidência entre graduação, êmbolo e limite do líquido. O desenho usa apenas formas, gradientes e recortes nativos. A renderização e o desempenho em Safari de iPhone físico permanecem pendentes de homologação.
