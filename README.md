# Protus · Controle de Estoque e Demanda de Montagem

Sistema web para controlar o estoque de materiais e a demanda de montagem dos robôs de atendimento
Protus (formato totem). Frontend em HTML + CSS + JavaScript puro, que funciona em dois modos:

- **Compartilhado (recomendado para a empresa)** — um computador roda o servidor (`server/server.js`,
  Node.js) e guarda os dados em um banco em arquivo; os outros computadores acessam pelo IP na rede
  local e veem o mesmo estoque.
- **Local** — sem servidor, os dados ficam no `localStorage` do próprio navegador (útil para teste ou
  publicação no GitHub Pages). A etiqueta no topo da tela mostra qual modo está ativo.

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
- **Entrada de Materiais** — busca qualquer material cadastrado, seleciona o item e lança o movimento:
  **entrada** (compras posteriores) ou **saída/correção** para remover quantidade lançada errada. A
  saída nunca deixa o estoque negativo e o histórico mostra entradas (+) e saídas (−).
- **Ordem de Produção** — seleciona as estruturas e a quantidade de robôs, consulta o estoque item a
  item e gera a **B.O.M.** separando o que é atendido pelo estoque e o que precisa ser comprado (com
  custo estimado e exportação em CSV). Ao produzir a ordem, o estoque é baixado e o total de robôs
  montados no dashboard é atualizado.

## Compartilhar com outros computadores (servidor + banco de dados)

O que precisa ser instalado: **apenas o Node.js LTS** (https://nodejs.org) no computador que vai ficar
como servidor. O banco de dados já vem embutido — os dados ficam no arquivo
`server/data/protus-db.json`, gravado de forma atômica, com backup diário em `server/data/backups/`.
Nenhum banco externo (MySQL/SQL Server) precisa ser instalado.

1. No computador servidor, instale o Node.js LTS e extraia a pasta do projeto (ex.: `C:\protus`).
2. Dê duplo clique em **`Iniciar-Servidor-Protus.bat`** (Linux/macOS: `./iniciar-servidor.sh`).
   O terminal mostra os endereços de acesso, por exemplo:

   ```
   http://localhost:4040
   http://192.168.0.15:4040
   ```

3. Libere a porta no firewall do Windows (uma vez só), em um `cmd` **como administrador**:

   ```bash
   netsh advfirewall firewall add rule name="Protus 4040" dir=in action=allow protocol=TCP localport=4040
   ```

4. Nos outros computadores/tablets da mesma rede, abra o navegador em `http://IP-DO-SERVIDOR:4040`
   (o IP que apareceu no passo 2) e entre com **Protus / Protus@4040**.

Dicas importantes:

- O servidor precisa ficar ligado para os outros acessarem; enquanto ele roda, tudo que é salvo vai
  para o banco no computador servidor.
- Cada tela busca as alterações dos outros computadores a cada 6 segundos.
- Para trocar a porta: `set PORT=8080` antes de rodar o `.bat` (ou `PORT=8080 ./iniciar-servidor.sh`).
- Backup: copie a pasta `server/data`.
- O login é único (administrador) e a rede local é considerada confiável — não exponha essa porta
  para a internet sem antes colocar HTTPS e usuários individuais.

## Como rodar apenas neste computador (sem servidor)

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
server/server.js           servidor HTTP + API do banco compartilhado (Node.js, sem dependências)
server/data/               banco de dados em arquivo e backups diários (não versionado)
Iniciar-Servidor-Protus.bat  atalho para subir o servidor no Windows
iniciar-servidor.sh        atalho para subir o servidor no Linux/macOS
```
