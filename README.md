# challenge

Aplicação interna para a Ferrapex: vai buscar os emails de encomendas e o catálogo à API da
Ferrapex, extrai de cada email o cliente, as linhas (referência + quantidade) e a data
pretendida, guarda tudo em PostgreSQL e permite consultar, filtrar, exportar, rever e editar
as encomendas.

## a) Tecnologia escolhida e porquê

**Next.js (TypeScript) + PostgreSQL, tudo em Docker Compose.**

- **Next.js:** é uma ferramenta que 12 pessoas não técnicas vão usar todos os dias, por isso
  pesou mais a qualidade da interface do que a linguagem que domino melhor (Python). Um só
  projeto faz os ecrãs (com shadcn/ui), a sincronização com a API e o acesso à base de dados.
- **PostgreSQL em Docker Compose:** a app e a base de dados arrancam juntas com
  `docker compose up`, iguais em qualquer máquina, e ficam prontas para correr num servidor
  partilhado pela equipa.
- **SQL escrito à mão, sem ORM:** com 4 tabelas, o SQL que escrevo é o que corre, fácil de ler
  e de corrigir.
- **Extração com regex,** num módulo isolado e testado. Há um extrator com LLM pronto, mas
  desligado até saber se posso enviar os emails dos clientes a um serviço externo.

**Alternativa posta de lado:** Django + HTMX, que perdeu na qualidade da interface (explicado
no ponto d).

## b) Como correr (a partir de um computador limpo)

1. Instalar o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e abri-lo.
2. Clonar o repositório e entrar na pasta:
   ```bash
   git clone <url-do-repositório> && cd challenge
   ```
3. Criar o ficheiro de configuração e preencher o endereço da API da Ferrapex em
   `FERRAPEX_API_URL` e a chave em `FERRAPEX_API_KEY`:
   ```bash
   cp .env.example .env
   ```
4. Arrancar:
   ```bash
   docker compose up
   ```
5. Abrir <http://localhost:3000>. A primeira sincronização corre sozinha ao arrancar; depois,
   a cada 5 minutos ou ao carregar em **Sincronizar**.

Testes (precisa de Node.js 22):
```bash
npm install && npm test
```

Notas:
- A chave da API tem validade (até 2026-10-15). Se expirar, a barra de sincronização mostra
  "A chave da API é inválida ou expirou."
- O `.env` nunca é versionado. O LLM só é usado com `LLM_ENABLED=true` **e** `LLM_API_KEY`
  preenchidos.
- Para apagar todos os dados e começar do zero: `docker compose down -v`.

## c) O que a AI escreveu, o que foi corrigido à mão e o que ainda não é de confiança

A AI escreveu o código todo, fiz correções visuais a nível de apagar paragraphs que apresentavam informação redundante visualmente na app, tornando-a mais densa do que o necessário. Validei a base de dados, tabelas, ligações etc... manualmente, para garantir que a informação estava guardada e relacionada corretamente.

Não confio na forma como se está a extrair a informação dos emails, pois por enquanto estes vêm com um formato padronizado e limpo. Contudo, diferentes empresas podem enviar de diferentes formas (p.ex: números de quantidades por extenso, ou dar 3 códigos seguidos, e depois colocar as quantidades para cada um respetivamente), por enquanto o código não está pronto para isso, mas tenho uma ideia de como se poderia abordar o problema.



## d) Uma decisão em que não segui a AI

_(A preencher pelo autor. Candidatas, com o detalhe em `brain/tech-stack.md`:)_
- **D1.3** — a AI recomendou o LLM (Gemini Flash) ligado por omissão; ficou desligado porque
  ainda não sei se posso partilhar os dados dos emails com terceiros.
- **D2.1** — a AI recomendou Django + HTMX; escolhi Next.js pela qualidade da interface.
- **D4.1** — a AI recomendou SQLite; escolhi Postgres em Docker Compose pela portabilidade.
- **D1.1** — a AI recomendou bloquear para revisão humana quando regex e LLM discordam;
  decidi que o LLM decide, para não travar o fluxo.
- **D4.3** — o modelo de dados foi simplificado para quatro tabelas.


Alternativas rejeitadas:
- **Django + HTMX** (em vez de Next.js): traz autenticação e admin, mas numa ferramenta
  interna com três ecrãs isso não decide; pesou mais a qualidade da interface para quem a usa
  todos os dias.
- **SQLite** (em vez de Postgres + Docker): zero configuração, mas com Docker Compose o
  Postgres não custa nada a mais e fica pronto para correr em qualquer servidor.