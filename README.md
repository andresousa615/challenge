# challenge

Aplicação interna para a Ferrapex: vai buscar os emails de encomendas e o catálogo à API da
Ferrapex, extrai de cada email o cliente, as linhas (referência + quantidade) e a data
pretendida, guarda tudo em PostgreSQL e permite consultar, filtrar, exportar, rever e editar
as encomendas.

## a) Tecnologia escolhida e porquê

**Next.js (TypeScript) + PostgreSQL, tudo em Docker Compose.**

- **Next.js:** é uma ferramenta que 12 pessoas não técnicas vão usar todos os dias, por isso
  pesou mais a qualidade da interface do que a linguagem que domino melhor (Python). Um só
  projeto faz a interface (as páginas da app, com shadcn/ui), a sincronização com a API e o
  acesso à base de dados.
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

1. Instalar o [Docker Desktop](https://www.docker.com/products/docker-desktop/) e abri-lo
   (tem de estar a correr).

2. Clonar o repositório e entrar na pasta:
   ```bash
   git clone https://github.com/andresousa615/challenge.git && cd challenge
   ```

3. Criar o ficheiro de configuração:
   ```bash
   cp .env.example .env
   ```
   e preencher no `.env` o endereço da API em `FERRAPEX_API_URL` e a chave em
   `FERRAPEX_API_KEY` (os dois estão na página do desafio).

4. Arrancar:
   ```bash
   docker compose up
   ```
   A primeira vez demora alguns minutos, porque descarrega e constrói tudo. As seguintes são
   rápidas.

5. Abrir <http://localhost:3000>. A primeira sincronização corre sozinha ao arrancar; depois,
   a cada 5 minutos ou ao carregar em **Sincronizar**.

Para parar: `Ctrl+C` no terminal (ou `docker compose down`). Os dados ficam guardados para a
próxima vez.

Testes (precisa de Node.js 22):
```bash
npm install && npm test
```
Os mesmos testes, e um arranque completo com Docker a partir do zero, correm automaticamente no
GitHub a cada push ([GitHub Actions](https://github.com/andresousa615/challenge/actions)).

Notas:
- A chave da API tem validade (até 2026-10-15). Se expirar, a barra de sincronização mostra
  "A chave da API é inválida ou expirou."
- O `.env` nunca é versionado. O LLM só é usado com `LLM_ENABLED=true` **e** `LLM_API_KEY`
  preenchidos.
- Para apagar todos os dados e começar do zero: `docker compose down -v`. Isto apaga também as
  alterações feitas na app (estados, edições); a sincronização volta a trazer os emails.

## c) O que a AI escreveu, o que corrigi e em que ainda não confio

**O que a AI escreveu:** praticamente todo o código: a sincronização com a API, a extração, a
base de dados, as páginas da app e os testes. Usei-a para planear e para escrever, sempre por etapas,
validando cada uma antes de passar à seguinte.

**O que corrigi:** à mão, apaguei parágrafos que repetiam informação e tornavam as páginas mais
densas do que o necessário, e validei diretamente na base de dados (com SQL) que as tabelas, as
ligações e os valores estavam certos. Mas a maior parte das correções foram problemas que fui
notando ao usar a app e rever o código: coisas mal implementadas ou erros reais, que a AI não
tinha visto e que mandei corrigir. Alguns exemplos:
- O valor das encomendas era calculado com o preço atual do catálogo, por isso uma subida de
  preço alterava encomendas antigas. Agora cada linha guarda o preço, o nome e a unidade do
  momento em que foi registada.
- Um produto retirado do catálogo podia deixar encomendas antigas sem informação. Agora os
  produtos nunca são apagados, só marcados como inativos.

**Em que ainda não confio:**
- **A leitura dos emails.** Os 3 emails de exemplo vêm num formato limpo e regular, e a
  extração por regex foi feita para esse formato. Emails reais podem trazer descrições em vez
  de códigos, quantidades por extenso, vários códigos seguidos com as quantidades depois, ou
  respostas que citam o email anterior. Nesses casos a regex falha ou lê valores
  errados. A abordagem para tratar disto foi não ignorar o email mas deixa-lo para verificação manual, contudo não me parece a abordagem ideal.

- **O LLM como solução ainda não está provado.** A abordagem que poderia ajudar a resolver o problema anterior seria usar de forma complementar um LLM como extrator. Implementei isto em parte. O código à volta do LLM está testado: quando é chamado, como valida a resposta, a nova tentativa e o regresso ao resultado da regex se falhar. Mas esses testes usam respostas escritas por mim, não um modelo real. Nunca o liguei a um fornecedor, porque não sei se posso enviar os emails dos clientes a um serviço externo, por isso não sei se o pedido é aceite nem quão bem o modelo lê encomendas em texto livre. É uma hipótese a validar.

## d) Uma decisão em que não segui a AI

No início, a AI recomendou fazer a aplicação em **Django + HTMX**. Os argumentos eram: o facto de Python ser a linguagem que domino melhor, e traz integrações como login e painel de administração prontos.

Não segui essa recomendação e escolhi **Next.js (TypeScript)**. O Django destaca-se quando a
parte mais complexa é o backend (base de dados complexa, administração, login), e aqui o backend é
simples: ir buscar os emails, extrair, guardar e consultar. A parte que considerei mais importante é a
interface que os 12 trabalhadores da empresa usariam todos os dias, com filtros que reagem logo,
edição com confirmação e estados que se mudam na própria lista. O Next.js foi feito à volta da
interface, e junta a interface (as páginas que as pessoas usam) e o servidor num só projeto; no
Django, essa interatividade teria de vir de JavaScript extra, à parte. Por isso escolhi a
abordagem centrada na experiência de quem usa a app, mesmo sendo o Python a linguagem que
domino melhor. Depois de discutirmos os prós e contras, a AI concordou com a mudança.

