# 🚨 QUICK FIX FOR ADMIN PANEL

## Problem
You logged in with email `bogdyn13@gmail.com`, but the admin panel is not visible.

## Solution (2 ways):

### Method 1: Via special endpoint (EASIEST)

1. **Make sure `ADMIN_EMAILS` environment variable is set on Vercel:**
   - Go to Vercel Dashboard → your project → Settings → Environment Variables
   - Add: `ADMIN_EMAILS` = `bogdyn13@gmail.com`
   - Set it for Production environment
   - Restart the deployment

2. **Open in browser:**
   ```
   https://your-domain.vercel.app/api/fix-admin-role
   ```
   
3. **You will see a success message** - refresh the page and the admin panel will appear!

### Method 2: Via database (if method 1 doesn't work)

1. Connect to your PostgreSQL database
2. Run SQL query:
   ```sql
   -- First find your user ID from Clerk (it will be in the users table)
   SELECT id, role FROM users LIMIT 10;
   
   -- Then update the role (replace YOUR_USER_ID with your ID)
   UPDATE users SET role = 'admin' WHERE id = 'YOUR_USER_ID';
   ```

## Why does this happen?

1. **Environment variable not set** - the code checks email from `ADMIN_EMAILS` variable, if it's not set - role is not assigned
2. **User was created before adding the variable** - if you logged in before adding `ADMIN_EMAILS`, the role was already set as 'user'
3. **Cache** - sometimes you need to refresh the page or restart the deployment

## Verification

After fixing:
1. Log out and log in again
2. Or just refresh the page (F5)
3. Admin panel should be accessible at `/admin`

## If nothing helps

1. Check logs on Vercel - there will be errors there
2. Make sure the email matches exactly (case doesn't matter, but spaces do!)
3. Make sure the deployment restarted after adding the variable
