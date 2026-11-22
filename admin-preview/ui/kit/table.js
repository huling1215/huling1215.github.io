function sortTableRows(rows, sortKey, sortAsc) {
  if (!sortKey) return rows;
  return [...rows].sort((a, b) => {
    const va = a?.[sortKey] ?? '';
    const vb = b?.[sortKey] ?? '';
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'zh-CN');
    return sortAsc ? cmp : -cmp;
  });
}

function createTableHeader(columns, st, refresh) {
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.sortable !== false && col.key) {
      th.className = 'is-sortable';
      if (st.sortKey === col.key) th.textContent += st.sortAsc ? ' ↑' : ' ↓';
      th.addEventListener('click', () => {
        if (st.sortKey === col.key) st.sortAsc = !st.sortAsc;
        else { st.sortKey = col.key; st.sortAsc = true; }
        refresh();
      });
    }
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  return thead;
}

function createTableBody(columns, pageRows, emptyText) {
  const tbody = document.createElement('tbody');
  if (pageRows.length === 0) {
    const tr = document.createElement('tr');
    const td = Object.assign(document.createElement('td'), {
      colSpan: Math.max(1, columns.length),
      className: 'adm-table__empty',
      textContent: emptyText || '暂无符合条件的数据',
    });
    tr.appendChild(td);
    tbody.appendChild(tr);
    return tbody;
  }
  for (const row of pageRows) {
    const tr = document.createElement('tr');
    for (const col of columns) {
      const td = document.createElement('td');
      if (typeof col.render === 'function') {
        const rendered = col.render(row);
        if (rendered instanceof Node) td.appendChild(rendered);
        else td.textContent = String(rendered ?? '');
      } else {
        td.textContent = String(row?.[col.key] ?? '');
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  return tbody;
}

function drawTableView(ctx) {
  const { allRows, columns, pageSize, emptyText, st, countSpan, tableWrap, pager } = ctx;
  const filtered = st.query
    ? allRows.filter((r) => JSON.stringify(r).toLowerCase().includes(st.query))
    : allRows;
  const sorted = sortTableRows(filtered, st.sortKey, st.sortAsc);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  if (st.page > totalPages) st.page = totalPages;
  const slice = sorted.slice((st.page - 1) * pageSize, st.page * pageSize);

  countSpan.textContent = `共 ${sorted.length} 条记录`;
  tableWrap.innerHTML = '';
  const table = Object.assign(document.createElement('table'), { className: 'adm-table' });
  table.append(createTableHeader(columns, st, () => drawTableView(ctx)), createTableBody(columns, slice, emptyText));
  tableWrap.appendChild(table);

  pager.innerHTML = '';
  if (totalPages > 1) {
    const prev = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '上一页', disabled: st.page <= 1 });
    const info = Object.assign(document.createElement('span'), { className: 'adm-muted', textContent: `第 ${st.page} / ${totalPages} 页` });
    const next = Object.assign(document.createElement('button'), { type: 'button', className: 'adm-btn adm-btn--outline adm-btn--sm', textContent: '下一页', disabled: st.page >= totalPages });
    prev.addEventListener('click', () => { st.page -= 1; drawTableView(ctx); });
    next.addEventListener('click', () => { st.page += 1; drawTableView(ctx); });
    pager.append(prev, info, next);
  }
}

export function renderDataTable(container, options = {}) {
  const ctx = {
    columns: options.columns || [],
    allRows: Array.isArray(options.rows) ? options.rows : [],
    pageSize: options.pageSize || 15,
    emptyText: options.emptyText,
    st: { query: '', sortKey: options.defaultSortKey || '', sortAsc: Boolean(options.defaultSortAsc), page: 1 },
    countSpan: Object.assign(document.createElement('span'), { className: 'adm-muted' }),
    tableWrap: Object.assign(document.createElement('div'), { className: 'adm-table-wrap' }),
    pager: Object.assign(document.createElement('div'), { className: 'adm-pager' }),
  };

  container.innerHTML = '';
  const toolbar = Object.assign(document.createElement('div'), { className: 'adm-table-bar' });
  if (options.searchable !== false) {
    const search = Object.assign(document.createElement('input'), {
      type: 'search',
      className: 'adm-input',
      placeholder: options.filterPlaceholder || '输入关键词快速筛选…',
    });
    search.addEventListener('input', () => {
      ctx.st.query = search.value.trim().toLowerCase();
      ctx.st.page = 1;
      drawTableView(ctx);
    });
    toolbar.appendChild(search);
  }
  toolbar.appendChild(ctx.countSpan);
  container.append(toolbar, ctx.tableWrap, ctx.pager);
  drawTableView(ctx);
}
