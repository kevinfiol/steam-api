run:
	deno run --allow-net --allow-read --allow-env main.ts

watch:
	denon run --allow-net --allow-read --allow-env main.ts

migrate-steam_app:
	deno run --allow-read --allow-env --allow-net --unstable .\migrations\001-steam_app.js

migrate-steam_category:
	deno run --allow-read --allow-env --allow-net --unstable .\migrations\002-steam_category.js