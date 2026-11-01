# M&H Boutique Hotel – website

Plain HTML / CSS / JS rebuild of the Canva site
(https://mandhboutiquehotel.my.canva.site/hotels-business-website/), kept identical in layout and content.

## Structure

```
index.html                 Home
accommodation.html         Studio, 1, 2 and 3 bedroom
services-activities.html   Services & Activities
food-drinks.html           Food & Drinks
menus.html                 Food + drinks menu (images of the Canva menu pages)
about-us.html              About us
book-now.html              Reservation form
reviews.html               Reviews + "Add your review" popup
gallery.html               Picture gallery
css/style.css              All styles
js/main.js                 Mobile menu, booking form, review popup
assets/images/             Photos, logo, menu pages
vercel.json                Clean URLs on Vercel (/accommodation instead of /accommodation.html)
```

## Preview locally

Open `index.html` in a browser, or run a local server from this folder:

```
python3 -m http.server 8000
```

then visit http://localhost:8000

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repo, framework preset **Other**, no build command, output directory `.` (root).
3. Deploy. (Or run `npx vercel` from this folder.)

## Forms (booking + reviews)

By default, submitting the booking form or a review opens the visitor's email app with the
details pre-filled to `mandhboutiquehotel@gmail.com`.

To receive submissions directly instead, create a free form at https://formspree.io (or similar)
and paste its endpoint into `FORM_ENDPOINT` at the top of `js/main.js`.

## To do

- Social icons in the footer link to `#` – the Canva site has no links on them. Add the real
  Facebook / Instagram / TikTok URLs in each page's footer.
