# Phase 8: Quick Reference — Copy-Paste Examples

**Status:** ✅ COMPLETE | Build: ✅ ZERO ERRORS

---

## 📋 UnifiedDataTable — Quick Start

### Simple Table (No Selection)

```typescript
'use client';
import { UnifiedDataTable, type ColumnDef } from '@/components/table';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  tasksCount: number;
}

export function AgentsList() {
  const [agents] = useState<Agent[]>([
    { id: '1', name: 'Agent A', status: 'active', tasksCount: 5 },
    { id: '2', name: 'Agent B', status: 'inactive', tasksCount: 0 },
  ]);

  const columns: ColumnDef<Agent>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status' },
    { key: 'tasksCount', label: 'Tasks', align: 'center' },
  ];

  return (
    <UnifiedDataTable
      columns={columns}
      data={agents}
    />
  );
}
```

### Table with Selection + Bulk Delete

```typescript
'use client';
import { UnifiedDataTable, type ColumnDef, type BulkAction } from '@/components/table';
import { Trash2 } from 'lucide-react';

export function SelectableAgents() {
  const [agents, setAgents] = useState<Agent[]>([...]);

  const columns: ColumnDef<Agent>[] = [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
  ];

  const bulkActions: BulkAction<Agent>[] = [
    {
      label: 'Delete',
      variant: 'danger',
      onClick: async (selected) => {
        const ids = selected.map(a => a.id);
        await fetch(`/api/agents`, {
          method: 'DELETE',
          body: JSON.stringify({ ids }),
        });
        setAgents(agents.filter(a => !ids.includes(a.id)));
      },
    },
  ];

  return (
    <UnifiedDataTable
      columns={columns}
      data={agents}
      selectable={true}
      bulkActions={bulkActions}
    />
  );
}
```

### Table with Pagination + Sorting

```typescript
'use client';
import { UnifiedDataTable, type ColumnDef } from '@/components/table';

export function PaginatedAgents() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    // Fetch with pagination + sort
    fetch(`/api/agents?page=${page}&sortBy=${sortBy}&sortDir=${sortDir}`)
      .then(r => r.json())
      .then(data => {
        setAgents(data.items);
        setTotal(data.total);
      });
  }, [page, sortBy, sortDir]);

  const columns: ColumnDef<Agent>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'status', label: 'Status' },
  ];

  return (
    <UnifiedDataTable
      columns={columns}
      data={agents}
      sortBy={sortBy}
      sortDir={sortDir}
      onSort={(col) => {
        setSortBy(col as 'name');
        setSortDir('asc');
      }}
      pagination={{
        page,
        limit: 20,
        total,
        onPage: setPage,
      }}
    />
  );
}
```

### Table with Custom Cell Rendering

```typescript
'use client';
import { UnifiedDataTable, type ColumnDef } from '@/components/table';
import { Badge } from '@/components/common';

export function AgentsWithCustomRender() {
  const columns: ColumnDef<Agent>[] = [
    { key: 'name', label: 'Name' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <Badge variant={status === 'active' ? 'success' : 'secondary'}>
          {status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => new Date(date).toLocaleDateString(),
      align: 'center',
    },
  ];

  return (
    <UnifiedDataTable columns={columns} data={agents} />
  );
}
```

---

## 🔍 useSearch — Quick Start

### Basic Search

```typescript
'use client';
import { useSearch } from '@/hooks';
import { UnifiedDataTable, type ColumnDef } from '@/components/table';

export function SearchableAgents() {
  const search = useSearch({
    onSearch: async (state) => {
      const params = new URLSearchParams({
        q: state.query,
        page: String(state.page),
        limit: String(state.limit),
      });
      const res = await fetch(`/api/agents?${params}`);
      return res.json();
    },
    limit: 20,
  });

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        placeholder="Search agents..."
        className="w-full px-3 py-2 rounded border border-surface-border"
      />

      {search.loading && <Skeleton rows={5} />}
      {search.error && <p className="text-red-500">{search.error}</p>}
      {!search.loading && (
        <>
          <UnifiedDataTable
            columns={columns}
            data={search.data}
            pagination={{
              page: search.page,
              limit: search.limit,
              total: search.total,
              onPage: search.setPage,
            }}
          />
        </>
      )}
    </div>
  );
}
```

### Search with Filters

```typescript
'use client';
import { useSearch } from '@/hooks';

export function FilteredSearch() {
  const search = useSearch({
    onSearch: async (state) => {
      const params = new URLSearchParams({
        q: state.query,
        page: String(state.page),
        status: state.filters.status || '',
        sortBy: state.sortBy || 'name',
      });
      const res = await fetch(`/api/agents?${params}`);
      return res.json();
    },
    initialFilters: { status: 'active' },
    limit: 20,
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        value={search.query}
        onChange={(e) => search.setQuery(e.target.value)}
        placeholder="Search..."
      />

      {/* Status filter */}
      <select
        value={search.filters.status || ''}
        onChange={(e) =>
          search.setFilters(f => ({ ...f, status: e.target.value }))
        }
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      {/* Clear button */}
      <button onClick={() => search.clearFilters()}>
        Clear Filters
      </button>

      {/* Results */}
      <UnifiedDataTable
        data={search.data}
        columns={columns}
        pagination={{
          page: search.page,
          limit: search.limit,
          total: search.total,
          onPage: search.setPage,
        }}
      />
    </div>
  );
}
```

### Search with Sorting

```typescript
'use client';
import { useSearch } from '@/hooks';

export function SortableSearch() {
  const search = useSearch({
    onSearch: async (state) => {
      const params = new URLSearchParams({
        q: state.query,
        page: String(state.page),
        sortBy: state.sortBy || 'name',
        sortDir: state.sortDir || 'asc',
      });
      const res = await fetch(`/api/agents?${params}`);
      return res.json();
    },
  });

  return (
    <UnifiedDataTable
      columns={columns}
      data={search.data}
      sortBy={search.sortBy}
      sortDir={search.sortDir}
      onSort={(col) => search.setSort(String(col))}
      pagination={{
        page: search.page,
        limit: search.limit,
        total: search.total,
        onPage: search.setPage,
      }}
    />
  );
}
```

---

## 🎯 FilterPanel — Quick Start

### Sidebar Filter Panel

```typescript
'use client';
import { FilterPanel, type FilterField } from '@/components/common';
import { useSearch } from '@/hooks';

export function AgentsWithSidebar() {
  const search = useSearch({
    onSearch: async (state) => {
      const res = await fetch(
        `/api/agents?q=${state.query}&status=${state.filters.status}`
      );
      return res.json();
    },
  });

  const filterFields: FilterField[] = [
    {
      id: 'search',
      label: 'Search',
      type: 'text',
      value: search.query,
      onChange: search.setQuery,
      placeholder: 'Search agents...',
    },
    {
      id: 'status',
      label: 'Status',
      type: 'multiselect',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      value: search.filters.status,
      onChange: (v) => search.setFilters(f => ({ ...f, status: v })),
    },
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <FilterPanel
          mode="sidebar"
          title="Filters"
          fields={filterFields}
          onClear={() => search.clearFilters()}
        />
      </div>

      {/* Content */}
      <div className="flex-1">
        <UnifiedDataTable data={search.data} columns={columns} />
      </div>
    </div>
  );
}
```

### Drawer Filter Panel (Mobile)

```typescript
'use client';
import { FilterPanel } from '@/components/common';
import { useState } from 'react';

export function AgentsWithDrawerFilter() {
  const [filterOpen, setFilterOpen] = useState(false);
  const search = useSearch({ /* ... */ });

  return (
    <div className="space-y-4">
      <FilterPanel
        mode="drawer"
        open={filterOpen}
        onToggle={setFilterOpen}
        fields={[...]}
        onClear={() => search.clearFilters()}
      />

      <UnifiedDataTable data={search.data} columns={columns} />
    </div>
  );
}
```

---

## ⚙️ BulkActionBar — Quick Start

### Standalone Bulk Action Bar

```typescript
'use client';
import { BulkActionBar, type BulkActionItem } from '@/components/common';
import { useState } from 'react';

export function BulkActionsExample() {
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const bulkActions: BulkActionItem[] = [
    {
      id: 'delete',
      label: 'Delete',
      variant: 'danger',
      onClick: async () => {
        await fetch(`/api/agents`, {
          method: 'DELETE',
          body: JSON.stringify({ ids: selectedIds }),
        });
        setSelectedIds([]);
      },
    },
    {
      id: 'archive',
      label: 'Archive',
      variant: 'secondary',
      onClick: async () => {
        await fetch(`/api/agents/archive`, {
          method: 'POST',
          body: JSON.stringify({ ids: selectedIds }),
        });
        setSelectedIds([]);
      },
    },
  ];

  return (
    <BulkActionBar
      count={selectedCount}
      itemLabel="agents"
      actions={bulkActions}
      onDismiss={() => {
        setSelectedIds([]);
        setSelectedCount(0);
      }}
    />
  );
}
```

### With Loading State

```typescript
'use client';
import { BulkActionBar } from '@/components/common';
import { Trash2 } from 'lucide-react';

export function BulkActionsWithLoading() {
  const [loading, setLoading] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await fetch(`/api/agents`, {
        method: 'DELETE',
        body: JSON.stringify({ ids: selectedIds }),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <BulkActionBar
      count={selectedCount}
      actions={[
        {
          id: 'delete',
          label: 'Delete',
          variant: 'danger',
          loading: loading,
          onClick: handleDelete,
          icon: <Trash2 className="w-4 h-4" />,
        },
      ]}
    />
  );
}
```

---

## 🎨 Complete Page Example

### Full Page: Agents with Search + Filter + Bulk Actions

```typescript
'use client';
import { useState } from 'react';
import { UnifiedDataTable, type ColumnDef } from '@/components/table';
import { FilterPanel, type FilterField, Badge } from '@/components/common';
import { useSearch } from '@/hooks';
import { SkeletonTable } from '@/components/common';

interface Agent {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'archived';
  tasksCount: number;
  createdAt: string;
}

export default function AgentsPage() {
  // Search & filtering
  const search = useSearch({
    onSearch: async (state) => {
      const params = new URLSearchParams({
        q: state.query,
        page: String(state.page),
        limit: String(state.limit),
        status: state.filters.status || '',
        sortBy: state.sortBy || 'name',
        sortDir: state.sortDir || 'asc',
      });
      const res = await fetch(`/api/agents?${params}`);
      return res.json();
    },
    initialFilters: { status: 'active' },
    limit: 20,
  });

  // Filter fields
  const filterFields: FilterField[] = [
    {
      id: 'search',
      label: 'Search',
      type: 'text',
      value: search.query,
      onChange: search.setQuery,
      placeholder: 'Search agents...',
    },
    {
      id: 'status',
      label: 'Status',
      type: 'multiselect',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'archived', label: 'Archived' },
      ],
      value: search.filters.status,
      onChange: (v) => search.setFilters(f => ({ ...f, status: v })),
    },
  ];

  // Columns
  const columns: ColumnDef<Agent>[] = [
    { key: 'name', label: 'Name', sortable: true, width: 'w-48' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <Badge variant={status === 'active' ? 'success' : 'secondary'}>
          {status}
        </Badge>
      ),
    },
    { key: 'tasksCount', label: 'Tasks', align: 'center', sortable: true },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => new Date(date).toLocaleDateString(),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Agents</h1>
        <p className="text-zinc-400">Manage your AI agents</p>
      </div>

      {/* Filters + Table */}
      <div className="flex gap-6">
        {/* Sidebar (desktop only) */}
        <div className="hidden lg:block w-64 flex-shrink-0">
          <FilterPanel
            mode="sidebar"
            title="Filters"
            fields={filterFields}
            onClear={() => search.clearFilters()}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-4">
          {/* Mobile filter (drawer) */}
          <div className="lg:hidden mb-4">
            <FilterPanel
              mode="drawer"
              title="Filters"
              fields={filterFields}
              onClear={() => search.clearFilters()}
            />
          </div>

          {/* Table */}
          {search.loading ? (
            <SkeletonTable rows={search.limit} />
          ) : search.error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded text-red-200">
              {search.error}
            </div>
          ) : (
            <UnifiedDataTable
              columns={columns}
              data={search.data}
              selectable={true}
              bulkActions={[
                {
                  label: 'Delete',
                  variant: 'danger',
                  onClick: async (rows) => {
                    const ids = rows.map(r => r.id);
                    await fetch(`/api/agents`, {
                      method: 'DELETE',
                      body: JSON.stringify({ ids }),
                    });
                    search.setQuery(''); // Refetch
                  },
                },
              ]}
              sortBy={search.sortBy}
              sortDir={search.sortDir}
              onSort={(col) => search.setSort(String(col))}
              pagination={{
                page: search.page,
                limit: search.limit,
                total: search.total,
                onPage: search.setPage,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## 🚀 Integration Checklist

For each page (agents, tasks, approvals, workflows):

```
[ ] Install UnifiedDataTable
[ ] Install useSearch hook
[ ] Create columns definition
[ ] Create bulk actions
[ ] Add FilterPanel (if needed)
[ ] Test pagination
[ ] Test sorting
[ ] Test selection
[ ] Test bulk operations
[ ] Test mobile responsive
[ ] Test error states
[ ] Test loading states
```

---

## 📋 Common Patterns

### Pattern: Search + Filter + Sort + Paginate + Bulk

Copy this template and customize for your page:

```typescript
'use client';
import { useSearch } from '@/hooks';
import { UnifiedDataTable, type ColumnDef } from '@/components/table';
import { FilterPanel, type FilterField } from '@/components/common';

export default function DataPage() {
  // 1. Setup search
  const search = useSearch({
    onSearch: async (state) => {
      // Customize: Replace /api/items with your endpoint
      const res = await fetch(
        `/api/items?q=${state.query}&page=${state.page}&limit=${state.limit}`
      );
      return res.json();
    },
    limit: 20,
  });

  // 2. Define filters
  const filterFields: FilterField[] = [
    {
      id: 'search',
      label: 'Search',
      type: 'text',
      value: search.query,
      onChange: search.setQuery,
      placeholder: 'Search...',
    },
  ];

  // 3. Define columns
  const columns: ColumnDef<YourType>[] = [
    { key: 'name', label: 'Name', sortable: true },
  ];

  // 4. Render
  return (
    <div className="space-y-6">
      <FilterPanel
        mode="sidebar"
        fields={filterFields}
        onClear={() => search.clearFilters()}
      />

      <UnifiedDataTable
        columns={columns}
        data={search.data}
        loading={search.loading}
        selectable={true}
        pagination={{
          page: search.page,
          limit: search.limit,
          total: search.total,
          onPage: search.setPage,
        }}
      />
    </div>
  );
}
```

---

**Phase 8 is production-ready. Copy examples above into your pages!**
