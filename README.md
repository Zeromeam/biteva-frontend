# Biteva order page update

## Files in this package
- `app/order/page.tsx`
- `components/order-builder.tsx`
- `PHOTO-GUIDE.md`

## Where to put the files
Copy the files into your project like this:

- `app/order/page.tsx` → `your-project/app/order/page.tsx`
- `components/order-builder.tsx` → `your-project/components/order-builder.tsx`

## Product photo folder
Put your product photos here:

`your-project/public/images/order/`

## Product photo filenames
Use exactly these names:

- `beef.jpg`
- `chicken-skewer.jpg`
- `vegan.jpg`

## What this page does
- Shows 3 products with a blue plus button
- Opens a popup when the plus button is pressed
- Step 1: choose side and sauce
- Step 2: choose drink
- Back button from drinks to sides
- Adds the configured item to the cart
- Keeps customer details inside the cart panel
- Sends the order to `/api/order` when pressing **Buy now**

## Important backend note
The **Buy now** button sends this payload to `/api/order`:

- `customer`
- `items`
- `totals`

If your current API route uses different field names, only edit the `payload` object inside:

`components/order-builder.tsx`

Search for:

`const payload = { ... }`

## Run it
In your project folder:

```bash
npm run dev
```
