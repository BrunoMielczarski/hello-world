# Protus · Controle de Estoque e Demanda de Montagem

Sistema web para controlar o estoque de materiais e a demanda de montagem dos robôs de atendimento
Protus (formato totem). Aplicação 100% estática (HTML + CSS + JavaScript puro), com dados salvos no
`localStorage` do navegador — pode ser publicada direto no GitHub Pages.

## Acesso

| Usuário | Senha         | Perfil        |
| ------- | ------------- | ------------- |
| Protus  | `Protus@4040` | Administrador |

O administrador tem acesso a todas as funções.

## Telas

- **Dashboard** — robôs montados, robôs em produção, ordens abertas, valor em estoque, itens abaixo do
  mínimo, compras necessárias das ordens abertas e ordens recentes.
- **Cadastro de Materiais** — código, descrição, unidade, estoque inicial, estoque mínimo, custo e
  fornecedor. O estoque informado no cadastro é registrado como entrada de "Estoque inicial".
- **Cadastro de Estrutura** — cria conjuntos (ex.: **Cabeça**, Corpo, Base) e adiciona vários materiais
  cadastrados com a quantidade usada por robô.
- **Entrada de Materiais** — busca qualquer material cadastrado, seleciona o item e adiciona quantidade
  (compras posteriores), com documento/NF, fornecedor e histórico das entradas.
- **Ordem de Produção** — seleciona as estruturas e a quantidade de robôs, consulta o estoque item a
  item e gera a **B.O.M.** separando o que é atendido pelo estoque e o que precisa ser comprado (com
  custo estimado e exportação em CSV). Ao produzir a ordem, o estoque é baixado e o total de robôs
  montados no dashboard é atualizado.

## Como rodar no seu computador (Windows)

1. Baixe o projeto: na página do repositório no GitHub, clique em **Code → Download ZIP** e extraia
   a pasta (ex.: em `C:\protus`).
2. Instale o Python (uma vez só): https://www.python.org/downloads/ — na instalação, marque
   **Add Python to PATH**.
3. Abra a pasta extraída, clique na barra de endereço do Explorer, digite `cmd` e pressione Enter.
4. Rode o servidor local:

   ```bash
   python -m http.server 8000
   ```

5. Abra no navegador: http://localhost:8000 e entre com **Protus / Protus@4040**.

Para parar, feche a janela do `cmd`. No Linux/macOS o comando é `python3 -m http.server 8000`.

Os módulos JavaScript usam `type="module"`, portanto é necessário servir os arquivos por HTTP —
abrir o `index.html` com duplo clique (`file://`) **não** funciona.

Alternativa sem instalar nada: após o merge, ative **Settings → Pages → Branch: master** no
repositório; o sistema fica disponível em `https://brunomielczarski.github.io/hello-world/`.
Os dados ficam salvos no navegador de cada máquina (`localStorage`).

Use o botão **Carregar dados de exemplo** no topo da tela para popular materiais, estruturas
(Cabeça/Corpo/Base) e ordens de demonstração.

## Estrutura do projeto

```
index.html
assets/css/styles.css      paleta laranja/azul-marinho da marca
assets/img/                logo AI Protus e rosto do robô (PNG recortado, fundo transparente)
assets/js/store.js         modelo de dados, cálculo de B.O.M. e persistência
assets/js/ui.js            formatação, toasts e tags de status
assets/js/views/           dashboard, materiais, estruturas, entradas e ordens
```
