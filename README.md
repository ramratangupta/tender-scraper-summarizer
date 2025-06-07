# Building Tender Summary Generator Application Using Google Gemini
This will help to integrate multiple components of a modern web application: data collection, backend logic, LLM integration, and frontend

## Overview:
Learning mini-application that:
* Scrapes data from a government tender website
* Passes relevant tender information through a Large Language Model (LLM) to generate a user-friendly summary.

### Redis Data Structure

- I have used hash, zrange, norval key value
- "queue_tender_4995" this stores raw data
- `keys *`
```
127.0.0.1:6379> keys *
 1) "tender:5001"
 2) "tender:5009"
 3) "tender:5011"
 4) "tender:4500"
 5) "tender:5010"
 6) "tender:5005"
 7) "tender:5017"
 8) "tender:5014"
 9) "tender:5019"
10) "tenders:by:date"
11) "tender:5018"
12) "tender:5015"
13) "tender:5016"
14) "queue_tender_4995"
15) "tender:5012"
16) "tender:5013"
127.0.0.1:6379> get "queue_tender_4995"
"{\"tenderid\":4995,\"title\":\"Supply, installation and commissioning of a multiaxis CNC system and fibre laser wobble welding head with accessories\",\"lastDate\":\"2025-06-10\",\"publishDate\":\"2025-05-13\",\"tenderURL\":\"https://home.iitd.ac.in/public/storage/tenders/NIQ_1747116967.pdf\",\"raw_description\":\"\\n\\n1 \\n \\nNotice Inviting Quotation.....

127.0.0.1:6379> hgetall "tender:5012"
 1) "requirements"
 2) "Advanced USG ....
 n BOQ_XXXX.xls format"
 3) "email"
 4) "bmukherjee@iitd.ac.in"
 5) "aiml_summary"
 6) "Indian Institute ...."
 7) "title"
 8) "Advanced USG System with Shear Wave Elastography"
 9) "tenderid"
10) "5012"
11) "publishDate"
12) "2025-06-02"
13) "raw_description"
14) "...LS \n \n "
15) "phone"
16) "01126598512"
17) "tenderURL"
18) "https://home.iitd.ac.in/public/storage/tenders/NIT_1748856898.pdf"
19) "lastDate"
20) "2025-06-30"

127.0.0.1:6379> zrange "tenders:by:date" 0 -1 withscores
 1) "5010"
 2) "1749168000"
 3) "4995"
 4) "1749513600"
 5) "5014"
 6) "1749513600"
 7) "5015"
 8) "1749513600"
 9) "5017"
10) "1749600000"
11) "5009"
12) "1749686400"
13) "5016"
14) "1749686400"
15) "5018"
16) "1749686400"
17) "4500"
18) "1750118400"
19) "5001"
20) "1750204800"
21) "5019"
22) "1750204800"
23) "5005"
24) "1750291200"
25) "5013"
26) "1750723200"
27) "5011"
28) "1750982400"
29) "5012"
30) "1751241600"

```

## Scraping:

Script or service that scrapes the portal for relevant tender details (e.g., title,
description, start date, closing date, department, contact info, etc.).

Store the raw data (or structured data) in a `Redis`
(depending on time constraints).

## Data Processing with LLM:

* Take the scraped details and pass them to an LLM
Generate a concise summary or short description for each tender.
* The summary should include:
A high-level overview of the opportunity.
Key dates/requirements extracted from the raw data.
Integrate error handling and best practices (e.g., throttling requests, caching responses) to deal with API constraints.

```
cd scraper && npm start
```
## Backend (API):
Provide an API endpoint REST that returns:
* The raw tender data.
* The LLM-generated summary.
* Optionally, allow filtering or searching by tender ID, date range, or keyword.

```
cd api && npm start
```
## Frontend:
- Implement a simple user interface using a modern frontend
- Display a list of tenders along with their summarized descriptions.
- Allow users to click into a tender to view more detailed information (raw details vs. summarized info).

```
cd frontend && npm start
```

## Deploy to Vercel
- After commit run `vercel` in root folder

## [PPT Link](https://docs.google.com/presentation/d/13pWlCn6h7zvoHiOJ2kmVe89IUoSnRUcL/edit?usp=sharing&ouid=114433674424419894797&rtpof=true&sd=true)

## ENV Variables

- api/.env and scraper/.env
```
GOOGLE_API_KEY=<apikey>
REDIS_URL=redis://default:<password>@127.0.0.1:6379
```
- frontend/.env.production
```
REACT_APP_API_URL=/api
```