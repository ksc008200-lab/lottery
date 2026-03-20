# Blueprint: Bichon Buff Blog

## Overview

A personal blog website for "Bichon Buff" showcasing automation tips and programs. The site is built with modern, framework-less web technologies (HTML, CSS, JS) and deployed via Cloudflare Pages. It features a clean, responsive design, blog post management, and interactive services.

## Implemented Features & Design

### Core Structure
- **Project Root:** `my-blog/`
- **Deployment:** Cloudflare Pages, auto-deployed from the `main` branch of a GitHub repository.
- **Main Page (`index.html`):** Displays a list of blog posts, a search bar, and category filters.
- **Admin Functionality:** In-place "수정(Edit)" and "삭제(Delete)" buttons for posts, visible to administrators.

### Design & Style
- **Layout:** Clean, card-based layout for blog posts.
- **Color Scheme:** Primarily black, white, and grey with green accents.
- **Typography:** Sans-serif fonts for readability.

### Content Pages
- **`ads.txt`:** Added for Google AdSense compliance.
- **`privacy.html`:** Outlines the privacy policy.
- **`terms.html`:** Outlines the terms of service.
- **`contact.html`:** Provides contact information.
- **Footer Navigation:** Links to policy pages and contact page added to the main page footer.

## Current Task: Add Lotto Number Generator

### Plan
1.  **Create Service Page:**
    *   Create a new file `my-blog/lotto.html` to house the generator.
    *   The page will have a title, a button to trigger the generation, and a visually appealing area to display the 6 generated numbers.
2.  **Implement Generator Logic:**
    *   Create a new JavaScript file `my-blog/lotto.js`.
    *   The script will generate 6 unique random numbers from 1 to 45.
    *   The numbers will be sorted and displayed dynamically on the page.
    *   The display will be enhanced with colors and animations for a better user experience.
3.  **Style the Page:**
    *   Create a new CSS file `my-blog/lotto.css` for custom styles.
    *   The design will be modern, interactive, and consistent with the blog's overall aesthetic. Each number will be displayed in a colored circle.
4.  **Integrate Navigation:**
    *   Modify `my-blog/index.html` to add a prominent link or button to the new "로또 생성기" (Lotto Generator) service. A good location would be in the header navigation area.
    *   Ensure consistent navigation across all pages by adding the link to the header of `privacy.html`, `terms.html`, and `contact.html` as well.
