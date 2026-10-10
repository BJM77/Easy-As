import os
import datetime

output_file = '810.txt'
generated_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S AWST')

header = f"""╔══════════════════════════════════════════════════════════════════════════════╗
║                        EZM - FULL SITE BACKUP                                ║
║                   BDA Online / Team Global Express                           ║
║                                                                              ║
║  Generated: {generated_time:<48} ║
║  Framework: Next.js 16 + React 18 + TypeScript                              ║
║  Backend: Firebase (Firestore, Auth, App Hosting)                            ║
║  AI: Google Genkit (Gemini)                                                  ║
║  Hosting: Firebase App Hosting (studio-7521332906-59af2 / bda-online)        ║
╚══════════════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════════════╗
║                     SECTION 1: SITE ARCHITECTURE                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│ PROJECT OVERVIEW                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EZM (BDA Online) is a freight pricing, quoting, and sales enablement       │
│  platform built for Team Global Express (TGE). It provides:                 │
│                                                                             │
│  • Freight rate calculators (B2B, B2C, LCP, PE, Pallet, Satchel)            │
│  • AI-powered quoting via Google Genkit (Gemini)                            │
│  • Lead management & CRM integration (Salesforce)                           │
│  • Problem logging & tracking                                               │
│  • Multi-tenant company isolation via Firebase Auth custom claims            │
│  • Rate card management & comparison tools                                  │
│  • Proposal generation & CSV converter                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ TECHNOLOGY STACK                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Frontend:                                                                  │
│    • Next.js 16.2.4 (App Router)                                            │
│    • React 18.3.1                                                           │
│    • TypeScript 5.x                                                         │
│    • Tailwind CSS 3.4.1                                                     │
│    • Radix UI (shadcn/ui component library)                                 │
│    • Framer Motion (animations)                                             │
│    • Recharts (data visualization)                                          │
│    • Lucide React (icons)                                                   │
│                                                                             │
│  Backend / Services:                                                        │
│    • Firebase Auth (session cookies + custom claims)                        │
│    • Cloud Firestore (database)                                             │
│    • Firebase App Hosting & Hosting                                         │
│    • Firebase Admin SDK (server-side session verification)                  │
│    • Google Genkit 1.8.0 (AI flows with Gemini)                             │
│    • Google Maps Embed API                                                  │
│                                                                             │
│  Utilities:                                                                 │
│    • Zod (schema validation)                                                │
│    • React Hook Form (form management)                                      │
│    • date-fns (date utilities)                                              │
│    • xlsx (Excel file processing)                                           │
│    • jszip (ZIP file handling)                                              │
│    • cheerio (HTML parsing)                                                 │
│    • uuid (unique ID generation)                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║                  SECTION 2: FIREBASE & GITHUB CONFIGURATION                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│ FIREBASE PROJECT DETAILS                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Project ID:        studio-7521332906-59af2                                 │
│  Auth Domain:       studio-7521332906-59af2.firebaseapp.com                 │
│  Storage Bucket:    studio-7521332906-59af2.firebasestorage.app             │
│  Messaging Sender:  1071384403415                                           │
│  App ID:            1:1071384403415:web:b1431206b85cc356033f92              │
│  Hosting Site:      bda-online                                              │
│  Hosting Target:    App Hosting (Next.js Dynamic SSR/API)                   │
│                                                                             │
│  Firestore Collections:                                                     │
│    • users         - User profiles, company associations & role claims      │
│    • leads         - Sales leads (tenant-isolated)                           │
│    • problems      - Problem logs & investigations                          │
│    • ai_quotes     - AI-generated rate quotes                               │
│    • companyRates  - Company custom rate cards                              │
│    • audit_logs    - Superadmin audit history                               │
│                                                                             │
│  Auth Custom Claims:                                                        │
│    • role: "superadmin" | "admin" | "user"                                  │
│    • companyId: string                                                      │
│    • assignedCompanyIds: string[]                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ GITHUB INFORMATION                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Repository:       https://github.com/BJM77/Easy-As.git                     │
│  Branch:           main                                                     │
│  Latest Commit:    8834ae2 (Fix the build and require a real login session) │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ ENVIRONMENT VARIABLES TEMPLATE (API KEYS REDACTED)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  # Client (browser-safe) Firebase config                                    │
│  NEXT_PUBLIC_FIREBASE_API_KEY=<REDACTED_API_KEY>                            │
│  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=studio-7521332906-59af2.firebaseapp.com   │
│  NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-7521332906-59af2                   │
│  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=studio-7521332906-59af2.firebasestorage.app
│  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1071384403415                     │
│  NEXT_PUBLIC_FIREBASE_APP_ID=1:1071384403415:web:b1431206b85cc356033f92     │
│  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<REDACTED_MEASUREMENT_ID>              │
│  NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=<REDACTED_GOOGLE_MAPS_KEY>           │
│                                                                             │
│  # Server-only AI key (App Hosting / Cloud Secrets)                         │
│  GEMINI_API_KEY=<REDACTED_GEMINI_API_KEY>                                   │
│  NEXT_PUBLIC_GEMINI_API_KEY=<REDACTED_GEMINI_API_KEY>                        │
│                                                                             │
│  # Firebase Admin (Service Account)                                         │
│  FIREBASE_PROJECT_ID=studio-7521332906-59af2                                │
│  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@studio-7521332906-59af2.iam.gserviceaccount.com
│  FIREBASE_PRIVATE_KEY=<REDACTED_PRIVATE_KEY>                                │
│  GOOGLE_APPLICATION_CREDENTIALS_JSON=<REDACTED_SERVICE_ACCOUNT_JSON>         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

╔══════════════════════════════════════════════════════════════════════════════╗
║                     SECTION 3: SOURCE CODE FILES                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

SKIP_DIRS = {'node_modules', '.next', '.git', 'olddata', 'Easy-As', '.idx', '.continue'}
SKIP_FILES = {
    '.DS_Store', 'serviceAccount.json', 'EZM_FULL_SITE_BACKUP.txt', '810.txt',
    'package-lock.json', 'tsconfig.tsbuildinfo', 'pglite-debug.log',
    '.env', '.env copy', '.env.local', 'env.download', 'env.txt',
    'src/.env.local', 'src/.env copy', 'src/.DS_Store', 'src/app/.DS_Store', 'src/components/.DS_Store',
    'generate_backup.py'
}
SKIP_EXTS = {'.bak', '.ico', '.png', '.jpg', '.jpeg', '.docx', '.pptx', '.pdf'}

root_order = [
    'package.json',
    'tsconfig.json',
    'next.config.mjs',
    'tailwind.config.ts',
    'postcss.config.mjs',
    'components.json',
    'apphosting.yaml',
    'next-env.d.ts',
    '.gitignore',
    '.firebaserc',
    '.eslintrc.json',
    '.npmrc',
    'firebase.json',
    'firestore.rules',
    'addSuperAdmin.js',
    'findUserUID.js',
    'generateEnvVar.js',
    'getEnvVar.js',
    'setSuperAdmin.js',
    'bulk_replace.js',
    'push_secrets.js',
    'README.md',
    'AGENTS.md',
    'CLAUDE.md',
    'FIX_AUTH_ERROR.md',
    'LEAD_FILTERING.md',
    'env.local.example',
]

file_list = []
for rf in root_order:
    if os.path.exists(rf):
        file_list.append(rf)

for f in sorted(os.listdir('docs')):
    p = os.path.join('docs', f)
    if os.path.isfile(p):
        file_list.append(p)

src_files = []
for r, d, fs in os.walk('src'):
    for f in fs:
        p = os.path.join(r, f)
        if p in SKIP_FILES or f in SKIP_FILES:
            continue
        _, ext = os.path.splitext(f)
        if ext in SKIP_EXTS:
            continue
        src_files.append(p)
src_files.sort()
file_list.extend(src_files)

# Supplemental documentation and calculator logic files
root_txts = [
    'How.txt', 'admin.txt', 'aicode.txt', 'allea.txt', 'devDependencies.txt',
    'logiccalculator.txt', 'lstdcode.txt', 'new.txt', 'pp.txt', 'prop.txt', 'sb.txt'
]
for rt in root_txts:
    if os.path.exists(rt):
        file_list.append(rt)

print(f"Collecting and writing {len(file_list)} files into {output_file}...")

with open(output_file, 'w', encoding='utf-8') as out:
    out.write(header)
    out.write('\n\n')
    
    current_category = None
    for file_path in file_list:
        if file_path.startswith('src/ai/'):
            cat = 'GENKIT AI FLOWS & CONFIG'
        elif file_path.startswith('src/app/api/'):
            cat = 'API ROUTES (NEXT.JS)'
        elif file_path.startswith('src/app/'):
            cat = 'APP PAGES & ROUTES'
        elif file_path.startswith('src/components/'):
            cat = 'UI COMPONENTS & HOOKS'
        elif file_path.startswith('src/context/'):
            cat = 'REACT CONTEXTS'
        elif file_path.startswith('src/firebase/'):
            cat = 'FIREBASE CLIENT & ADMIN'
        elif file_path.startswith('src/hooks/'):
            cat = 'CUSTOM HOOKS'
        elif file_path.startswith('src/lib/'):
            cat = 'LIBRARY & UTILITIES'
        elif file_path.startswith('src/public/'):
            cat = 'EMBEDDED DATA & METADATA'
        elif file_path.startswith('docs/'):
            cat = 'PROJECT DOCUMENTATION'
        elif '/' not in file_path and not file_path.endswith('.txt'):
            cat = 'ROOT CONFIGURATION FILES'
        elif file_path.endswith('.txt'):
            cat = 'SUPPLEMENTAL DOCUMENTATION & CALCULATOR LOGIC'
        else:
            cat = 'SOURCE CODE'
        
        if cat != current_category:
            current_category = cat
            out.write(f'\n--- {current_category} ---\n\n')
        
        separator = '═' * 80
        out.write(f'{separator}\n')
        out.write(f'FILE: {file_path}\n')
        out.write(f'{separator}\n\n')
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as inf:
                content = inf.read()
            out.write(content)
            if not content.endswith('\n'):
                out.write('\n')
            out.write('\n')
        except Exception as e:
            out.write(f'// Error reading file: {e}\n\n')

size = os.path.getsize(output_file)
print(f"Done! {output_file} created: {size:,} bytes")
