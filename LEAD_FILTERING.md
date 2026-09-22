# 🔒 Lead Filtering: User-Specific Access Control

## Overview
Leads are now filtered based on user role and UID. Only superadmins can see all leads; all other users (including admins, BDMs, and agents) will only see leads they created.

## Changes Made

### Lead Query Filtering
**File**: `src/app/problem-log/page-content.tsx`

**Before**:
```typescript
const canSeeAll = ['superadmin', 'admin', 'bdm'].includes(role || '');
```

**After**:
```typescript
// Only superadmins can see all leads
const canSeeAll = role === 'superadmin';
```

## How It Works

### For Superadmins 👑
- **Filter: "All Items"** → See ALL leads from all users
- **Filter: "My Items"** → See only their own leads
- Full visibility for oversight and management

### For All Other Roles (Admin, BDM, Agent, Driver, User)
- **Filter: "All Items"** → See only THEIR OWN leads (filtered by `userId`)
- **Filter: "My Items"** → See only THEIR OWN leads
- The "All Items" filter still works, but it's limited to their own data

## Database Query Logic

The Firestore query automatically filters based on role:

```typescript
if (canSeeAll && filter === 'all') {
    // Superadmin viewing all leads
    return query(baseQuery, orderBy('date', 'desc'));
}
// Everyone else (or superadmin viewing "My Items")
return query(baseQuery, where('userId', '==', user.uid), orderBy('date', 'desc'));
```

## Security Benefits

✅ **Data Privacy**: Users can't see other users' leads  
✅ **Role-Based Access**: Only superadmins have full visibility  
✅ **Automatic Filtering**: No manual checks needed in the UI  
✅ **Firestore-Level**: Filtering happens at the database query level  

## Testing the Feature

### As Superadmin:
1. Log in as `benjamin.mackie@teamglobalexp.com`
2. Go to **Activity Log** (problem-log page)
3. Click the **Leads** tab
4. **Filter: "All Items"** → You'll see leads from all users
5. **Filter: "My Items"** → You'll see only your leads

### As Agent (or any other role):
1. Use the "View As" dropdown to select **🎯 Agent**
2. Go to **Activity Log**
3. Click the **Leads** tab
4. **Both filters** → You'll only see leads created by your UID
5. Other users' leads are completely hidden

## Notes on Problems vs Leads

**Problems** still have the original logic:
- Superadmins, Admins, and BDMs can see all problems
- Other roles see only their own problems

**Leads** now have stricter access:
- **Only superadmins** can see all leads
- Everyone else sees only their own leads

This makes sense because leads are more sensitive business data that should be protected.

---

**Implementation Date**: 2025-11-24  
**Feature Status**: ✅ Active
