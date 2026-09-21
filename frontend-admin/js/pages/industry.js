/**
 * 行业知识页面 - 模块化控制器
 * @module IndustryPage
 */
(function (global) {
  'use strict';

  var Utils = App.Utils;
  var Table = App.Table;
  var Modal = App.Modal;
  var Select = App.Select;

  var NEW_LEVEL1_VALUE = '__new__';
  var NEW_LEVEL2_VALUE = '__new_level2__';

  // ====================== 页面状态 ======================
  var state = {
    industries: [],
    groups: [],
    currentIndustryId: '',
    editingIndustryId: null,
    editingKnowledgeId: null,
    level1Options: [],
    level2Map: {}
  };

  // ====================== DOM 元素缓存 ======================
  var elements = {};

  function cacheElements() {
    elements = {
      btnAddIndustry: document.getElementById('btnAddIndustry'),
      industryEmpty: document.getElementById('industryEmpty'),
      industryTableWrap: document.getElementById('industryTableWrap'),
      industryTableBody: document.getElementById('industryTableBody'),
      industrySelect: document.getElementById('industrySelect'),
      btnAddKnowledge: document.getElementById('btnAddKnowledge'),
      knowledgeEmpty: document.getElementById('knowledgeEmpty'),
      knowledgeBlock: document.getElementById('knowledgeBlock'),
      knowledgeTableBody: document.getElementById('knowledgeTableBody'),
      industryModal: document.getElementById('industryModal'),
      industryModalTitle: document.getElementById('industryModalTitle'),
      industryFormLevel1: document.getElementById('industryFormLevel1'),
      industryFormLevel2: document.getElementById('industryFormLevel2'),
      industryFormNewLevel1Wrap: document.getElementById('industryFormNewLevel1Wrap'),
      industryFormNewLevel1: document.getElementById('industryFormNewLevel1'),
      industryFormLevel2Wrap: document.getElementById('industryFormLevel2Wrap'),
      industryFormNewLevel2Wrap: document.getElementById('industryFormNewLevel2Wrap'),
      industryFormNewLevel2: document.getElementById('industryFormNewLevel2'),
      industryModalCancel: document.getElementById('industryModalCancel'),
      industryModalSubmit: document.getElementById('industryModalSubmit'),
      knowledgeModal: document.getElementById('knowledgeModal'),
      knowledgeModalTitle: document.getElementById('knowledgeModalTitle'),
      knowledgeFormIndustryWrap: document.getElementById('knowledgeFormIndustryWrap'),
      knowledgeFormIndustry: document.getElementById('knowledgeFormIndustry'),
      formStandardQ: document.getElementById('formStandardQ'),
      formSimilarQ: document.getElementById('formSimilarQ'),
      formAnswer: document.getElementById('formAnswer'),
      knowledgeModalCancel: document.getElementById('knowledgeModalCancel'),
      knowledgeModalSubmit: document.getElementById('knowledgeModalSubmit')
    };
  }

  // ====================== 行业分组（列表与下拉共用，保证两者一致）======================
  /**
   * 按一级行业分组，保持行业在数据中的首次出现顺序。
   * @param {Array} industries MockStore.getIndustries() 的结果
   * @returns {Array<{level1:string, parent:object|null, children:Array}>}
   */
  function buildIndustryGroups(industries) {
    var groups = [];
    var indexMap = {};
    industries.forEach(function (i) {
      var key = i.level1;
      if (indexMap[key] === undefined) {
        indexMap[key] = groups.length;
        groups.push({ level1: key, parent: null, children: [] });
      }
      var g = groups[indexMap[key]];
      if (i.level2) {
        g.children.push(i);
      } else if (!g.parent) {
        g.parent = i;
      }
      // 数据层已禁止同名一级重复；极端脏数据下重复一级仅保留首个作为标题，其余忽略
    });
    return groups;
  }

  /**
   * 将分组转换为下拉结构：一级选项必须显示名称（如「零售（一级）」），
   * 不再出现只有「（一级）」的无名称选项。
   */
  function buildGroupedSelectData(groups) {
    var result = {};
    groups.forEach(function (g) {
      var options = [];
      if (g.parent && g.level1) {
        options.push({ value: g.parent.id, label: g.level1 + '（一级）' });
      }
      g.children.forEach(function (c) {
        if (c.level2) options.push({ value: c.id, label: c.level2 + '（二级）' });
      });
      if (g.level1 && options.length > 0) {
        result[g.level1] = options;
      }
    });
    return result;
  }

  // ====================== 行业管理 ======================
  var IndustryManager = {
    /** 刷新分组数据并返回（列表渲染、下拉填充前先调用保证一致） */
    refreshGroups: function () {
      state.industries = MockStore.getIndustries();
      state.groups = buildIndustryGroups(state.industries);
      return state.groups;
    },

    render: function () {
      var groups = this.refreshGroups();

      Table.toggleEmpty(elements.industryEmpty, elements.industryTableWrap, groups.length === 0);

      var rows = [];
      groups.forEach(function (g) {
        if (g.parent) {
          rows.push({ type: 'parent', data: g.parent });
        } else {
          // 一级行业记录缺失（脏数据兜底）：显式提示，不再静默混入其他分组
          rows.push({ type: 'orphan-title', level1: g.level1 });
        }
        if (g.children.length === 0) {
          // 下属分类暂无内容：给出空态说明，而不是标题下留白
          rows.push({ type: 'empty-child', level1: g.level1, hasParent: !!g.parent });
        } else {
          g.children.forEach(function (c) {
            rows.push({ type: 'child', data: c, hasParent: !!g.parent });
          });
        }
      });

      Table.render(elements.industryTableBody, rows, function (row) {
        if (row.type === 'parent') {
          var i = row.data;
          return '<td class="text-slate-900 font-medium">' + Utils.escapeHtml(i.level1) + '</td>' +
            '<td class="text-slate-600">一级</td>' +
            '<td class="text-slate-500">※</td>' +
            '<td class="text-right">' +
              '<button type="button" class="btn-link ind-edit mr-2" data-id="' + i.id + '">编辑</button>' +
              '<button type="button" class="btn-link btn-link-danger ind-delete" data-id="' + i.id + '">删除</button>' +
            '</td>';
        }
        if (row.type === 'orphan-title') {
          return '<td class="text-amber-700 font-medium">' + Utils.escapeHtml(row.level1) +
              '<span class="ml-2 text-xs text-amber-600">（一级行业记录缺失，以下二级暂无归属）</span></td>' +
            '<td class="text-amber-600">异常</td>' +
            '<td class="text-slate-400">—</td>' +
            '<td class="text-right"></td>';
        }
        if (row.type === 'empty-child') {
          return '<td colspan="4" class="' + (row.hasParent ? 'pl-10 ' : '') + 'text-slate-400 bg-slate-50/60">' +
              '<span class="inline-flex items-center gap-2">' +
                '<span class="iconify" data-icon="lucide:inbox" data-width="14" data-height="14"></span>' +
                '该一级行业下暂无二级行业，可' +
                '<button type="button" class="btn-link ind-add-child" data-level1="' + encodeURIComponent(row.level1) + '">新增二级行业</button>' +
              '</span>' +
            '</td>';
        }
        // child
        var c = row.data;
        var nameCell = row.hasParent
          ? Utils.escapeHtml(c.level2)
          : Utils.escapeHtml(c.level2) + '<span class="ml-2 text-xs text-amber-600">（一级「' + Utils.escapeHtml(c.level1) + '」缺失）</span>';
        return '<td class="' + (row.hasParent ? 'pl-10 ' : '') + 'text-slate-700">' + nameCell + '</td>' +
          '<td class="text-slate-600">二级</td>' +
          '<td class="text-slate-600">' + Utils.escapeHtml(c.level1) + '</td>' +
          '<td class="text-right">' +
            '<button type="button" class="btn-link ind-edit mr-2" data-id="' + c.id + '">编辑</button>' +
            '<button type="button" class="btn-link btn-link-danger ind-delete" data-id="' + c.id + '">删除</button>' +
          '</td>';
      }, this.bindTableEvents.bind(this));
    },

    bindTableEvents: function (tbody) {
      var self = this;
      tbody.querySelectorAll('.ind-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.openModal(btn.dataset.id);
        });
      });
      tbody.querySelectorAll('.ind-add-child').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var level1 = '';
          try { level1 = decodeURIComponent(btn.dataset.level1 || ''); } catch (_) { level1 = btn.dataset.level1 || ''; }
          self.openModal(null, level1);
        });
      });
      tbody.querySelectorAll('.ind-delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.dataset.id;
          var target = state.industries.find(function (x) { return x.id === id; });
          if (!target) {
            Toast.show('该行业不存在或已被删除，请刷新列表', 'error');
            self.render();
            self.fillSelect();
            KnowledgeManager.render();
            return;
          }
          var childCount = 0;
          if (!target.level2) {
            childCount = state.industries.filter(function (x) {
              return x.level1 === target.level1 && x.level2;
            }).length;
          }
          if (childCount > 0) {
            // 数据层同样拦截；这里前置提示，避免多余确认
            Toast.show('该一级行业下还有 ' + childCount + ' 个二级行业，请先处理后再删除', 'error');
            return;
          }
          var knowledgeCount = MockStore.getIndustryKnowledge(id).length;
          var msg = knowledgeCount > 0
            ? '确定删除「' + target.name + '」？该行业下的 ' + knowledgeCount + ' 条知识将一并清除，且不可恢复。'
            : '确定删除「' + target.name + '」？此操作不可恢复。';
          Confirm.show(msg, function () {
            var result = MockStore.deleteIndustry(id);
            if (!result.success) {
              // 删除失败或中断：说明原因并保持原样，不重绘数据
              Toast.show(result.message || '删除失败，请重试', 'error');
              return;
            }
            if (state.currentIndustryId === id) {
              state.currentIndustryId = '';
              elements.industrySelect.value = '';
            }
            self.render();
            self.fillSelect();
            KnowledgeManager.render();
            if (result.knowledgeCount > 0) {
              Toast.show('行业已删除，' + result.knowledgeCount + ' 条知识已一并清除', 'success');
            } else {
              Toast.show('行业删除成功', 'success');
            }
          });
        });
      });
    },

    fillSelect: function () {
      if (!state.groups) this.refreshGroups();
      var groups = buildGroupedSelectData(state.groups);
      Select.fillGrouped(elements.industrySelect, groups, '全部行业', state.currentIndustryId);
      // 选中行业已失效时，Select 组件会回退为占位项，同步状态并重渲染知识区
      if (state.currentIndustryId && elements.industrySelect.value !== state.currentIndustryId) {
        state.currentIndustryId = '';
        KnowledgeManager.render();
      }
    },

    fillLevel1: function () {
      elements.industryFormLevel1.innerHTML = '<option value="">请选择一级行业</option>';
      var existingLevel1 = state.industries.filter(function (i) { return !i.level2; }).map(function (i) { return i.level1; });
      var seen = {};
      existingLevel1.forEach(function (v) {
        if (seen[v]) return;
        seen[v] = true;
        var opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        elements.industryFormLevel1.appendChild(opt);
      });
      var optNew = document.createElement('option');
      optNew.value = NEW_LEVEL1_VALUE;
      optNew.textContent = '＋ 新建一级行业';
      elements.industryFormLevel1.appendChild(optNew);
    },

    fillLevel2: function (level1) {
      elements.industryFormLevel2.innerHTML = '<option value="">不填则新增一级行业</option>';
      elements.industryFormLevel2.disabled = !level1 || level1 === NEW_LEVEL1_VALUE;
      elements.industryFormNewLevel2Wrap.classList.add('hidden');
      elements.industryFormNewLevel2.value = '';
      
      if (level1 && level1 !== NEW_LEVEL1_VALUE) {
        var preset = state.level2Map[level1] || [];
        var existing = state.industries.filter(function (i) {
          return i.level1 === level1 && i.level2;
        }).map(function (i) { return i.level2; });
        var merged = preset.slice();
        existing.forEach(function (v) {
          if (merged.indexOf(v) === -1) merged.push(v);
        });
        merged.forEach(function (v) {
          var opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          elements.industryFormLevel2.appendChild(opt);
        });
        var optNew = document.createElement('option');
        optNew.value = NEW_LEVEL2_VALUE;
        optNew.textContent = '＋ 新建二级行业';
        elements.industryFormLevel2.appendChild(optNew);
      }
    },

    /**
     * 打开行业弹窗
     * @param {string} [id] 编辑时的行业 id
     * @param {string} [presetLevel1] 新增二级时预选的一级行业名称
     */
    openModal: function (id, presetLevel1) {
      state.editingIndustryId = id || null;
      elements.industryModalTitle.textContent = id ? '编辑行业' : '新增行业';
      elements.industryFormNewLevel1.value = '';
      this.fillLevel1();

      if (id) {
        var ind = state.industries.find(function (i) { return i.id === id; });
        if (!ind) {
          Toast.show('该行业不存在或已被删除', 'error');
          return;
        }
        elements.industryFormLevel1.value = ind.level1;
        elements.industryFormNewLevel1Wrap.classList.add('hidden');
        elements.industryFormLevel2Wrap.classList.remove('hidden');
        this.fillLevel2(ind.level1);
        elements.industryFormLevel2.value = ind.level2;
      } else if (presetLevel1) {
        elements.industryFormLevel1.value = presetLevel1;
        elements.industryFormNewLevel1Wrap.classList.add('hidden');
        elements.industryFormLevel2Wrap.classList.remove('hidden');
        this.fillLevel2(presetLevel1);
        elements.industryFormLevel2.value = '';
      } else {
        elements.industryFormNewLevel1Wrap.classList.add('hidden');
        elements.industryFormLevel2Wrap.classList.remove('hidden');
        elements.industryFormLevel2.innerHTML = '<option value="">请先选择一级行业</option>';
        elements.industryFormLevel2.disabled = true;
      }

      elements.industryModal.style.display = 'flex';
    },

    closeModal: function () {
      elements.industryModal.style.display = 'none';
      state.editingIndustryId = null;
    },

    save: function () {
      var level1;
      var level2 = (elements.industryFormLevel2.value || '').trim();
      if (level2 === NEW_LEVEL2_VALUE) {
        level2 = (elements.industryFormNewLevel2.value || '').trim();
      }
      
      if (elements.industryFormLevel1.value === NEW_LEVEL1_VALUE) {
        level1 = (elements.industryFormNewLevel1.value || '').trim();
        level2 = '';
        if (!level1) {
          Toast.show('请输入新一级行业名称', 'error');
          return;
        }
      } else {
        level1 = (elements.industryFormLevel1.value || '').trim();
        if (!level1) {
          Toast.show('请选择一级行业', 'error');
          return;
        }
        if (!state.editingIndustryId && !level2) {
          Toast.show('新增二级时请选择或输入二级行业；若仅新增一级请选择"＋ 新建一级行业"并输入名称', 'error');
          return;
        }
      }
      
      var result;
      if (state.editingIndustryId) {
        result = MockStore.updateIndustry(state.editingIndustryId, level1, level2);
        if (!result.success) {
          Toast.show(result.message || '行业更新失败，请重试', 'error');
          return;
        }
        Toast.show('行业信息更新成功', 'success');
      } else {
        result = MockStore.createIndustry(level1, level2);
        if (!result.success) {
          Toast.show(result.message || '行业创建失败，请重试', 'error');
          return;
        }
        Toast.show('行业创建成功', 'success');
      }

      this.closeModal();
      this.render();
      this.fillSelect();
    }
  };

  // ====================== 知识管理 ======================
  var KnowledgeManager = {
    render: function () {
      var list = [];
      var allIndustries = MockStore.getIndustries();

      function pushFor(i) {
        (MockStore.getIndustryKnowledge(i.id) || []).forEach(function (k) {
          list.push({ industryId: i.id, industryName: i.name, data: k });
        });
      }

      if (state.currentIndustryId) {
        var current = allIndustries.find(function (i) { return i.id === state.currentIndustryId; });
        if (current) {
          pushFor(current);
        } else {
          // 筛选的行业已被删除：重置筛选，避免知识归入"找不到的行业"
          state.currentIndustryId = '';
          elements.industrySelect.value = '';
          allIndustries.forEach(pushFor);
        }
      } else {
        allIndustries.forEach(pushFor);
      }

      Table.toggleEmpty(elements.knowledgeEmpty, elements.knowledgeBlock, list.length === 0);
      
      if (list.length === 0) {
        elements.knowledgeTableBody.innerHTML = '';
        return;
      }

      Table.render(elements.knowledgeTableBody, list, function (row) {
        var k = row.data;
        return '<td class="text-subtle text-sm">' + Utils.escapeHtml(row.industryName) + '</td>' +
          '<td class="text-obsidian">' + Utils.escapeHtml(k.standardQ || '') + '</td>' +
          '<td class="text-subtle">' + Utils.escapeHtml((k.similarQs || []).join('；')) + '</td>' +
          '<td class="text-charcoal max-w-xs truncate">' + Utils.escapeHtml(k.answer || '') + '</td>' +
          '<td class="text-right">' +
            '<button type="button" class="btn-link k-edit mr-2" data-id="' + k.id + '" data-iid="' + row.industryId + '">编辑</button>' +
            '<button type="button" class="btn-link btn-link-danger k-delete" data-id="' + k.id + '" data-iid="' + row.industryId + '">删除</button>' +
          '</td>';
      }, this.bindTableEvents.bind(this));
    },

    bindTableEvents: function (tbody) {
      var self = this;
      tbody.querySelectorAll('.k-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var iid = btn.dataset.iid || state.currentIndustryId;
          if (iid) {
            state.currentIndustryId = iid;
            elements.industrySelect.value = iid;
          }
          self.openModal(btn.dataset.id);
        });
      });
      tbody.querySelectorAll('.k-delete').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var iid = btn.dataset.iid || state.currentIndustryId;
          Confirm.show('确定删除这条知识？', function () {
            MockStore.deleteIndustryKnowledge(iid, btn.dataset.id);
            self.render();
            Toast.show('知识删除成功', 'success');
          });
        });
      });
    },

    fillFormSelect: function () {
      var groups = IndustryManager.refreshGroups();
      var grouped = buildGroupedSelectData(groups);
      Select.fillGrouped(elements.knowledgeFormIndustry, grouped, '请选择要添加知识的行业');
    },

    openModal: function (id) {
      state.editingKnowledgeId = id || null;
      elements.knowledgeModalTitle.textContent = id ? '编辑知识' : '新增知识';
      
      if (id) {
        var exists = MockStore.getIndustries().some(function (i) { return i.id === state.currentIndustryId; });
        if (!exists) {
          state.currentIndustryId = '';
          elements.industrySelect.value = '';
          this.render();
          Toast.show('所属行业已不存在，无法编辑该知识', 'error');
          return;
        }
        elements.knowledgeFormIndustryWrap.style.display = 'none';
        var list = MockStore.getIndustryKnowledge(state.currentIndustryId);
        var k = list.find(function (x) { return x.id === id; });
        if (k) {
          elements.formStandardQ.value = k.standardQ || '';
          elements.formSimilarQ.value = (k.similarQs || []).join('\n');
          elements.formAnswer.value = k.answer || '';
        }
      } else {
        elements.knowledgeFormIndustryWrap.style.display = 'block';
        this.fillFormSelect();
        elements.knowledgeFormIndustry.value = '';
        elements.formStandardQ.value = '';
        elements.formSimilarQ.value = '';
        elements.formAnswer.value = '';
      }
      
      elements.knowledgeModal.style.display = 'flex';
    },

    closeModal: function () {
      elements.knowledgeModal.style.display = 'none';
      state.editingKnowledgeId = null;
    },

    save: function () {
      var standardQ = elements.formStandardQ.value.trim();
      var similarQs = elements.formSimilarQ.value.trim().split(/\n/).map(function (s) {
        return s.trim();
      }).filter(Boolean);
      var answer = elements.formAnswer.value.trim();
      
      if (!standardQ) {
        Toast.show('请填写标准问', 'error');
        return;
      }
      
      var industryId = state.editingKnowledgeId
        ? state.currentIndustryId
        : (elements.knowledgeFormIndustry.value || '').trim();
      
      if (!industryId) {
        Toast.show('请选择要添加知识的行业', 'error');
        return;
      }
      
      var result;
      if (state.editingKnowledgeId) {
        result = MockStore.updateIndustryKnowledge(industryId, state.editingKnowledgeId, {
          standardQ: standardQ,
          similarQs: similarQs,
          answer: answer
        });
        if (!result.success) {
          Toast.show(result.message || '知识更新失败，请重试', 'error');
          return;
        }
        Toast.show('知识更新成功', 'success');
      } else {
        result = MockStore.addIndustryKnowledge(industryId, {
          standardQ: standardQ,
          similarQs: similarQs,
          answer: answer
        });
        if (!result.success) {
          Toast.show(result.message || '知识创建失败，请重试', 'error');
          return;
        }
        Toast.show('知识创建成功', 'success');
      }
      
      this.closeModal();
      this.render();
    }
  };

  // ====================== 事件绑定 ======================
  function bindEvents() {
    elements.btnAddIndustry.addEventListener('click', function () {
      IndustryManager.openModal();
    });
    elements.industryModalCancel.addEventListener('click', function () {
      IndustryManager.closeModal();
    });
    elements.industryModalSubmit.addEventListener('click', function () {
      IndustryManager.save();
    });
    Modal.bindOverlayClose(elements.industryModal, function () {
      IndustryManager.closeModal();
    });

    elements.industryFormLevel1.addEventListener('change', function () {
      var val = elements.industryFormLevel1.value;
      if (val === NEW_LEVEL1_VALUE) {
        elements.industryFormNewLevel1Wrap.classList.remove('hidden');
        elements.industryFormLevel2Wrap.classList.add('hidden');
        elements.industryFormNewLevel1.focus();
      } else {
        elements.industryFormNewLevel1Wrap.classList.add('hidden');
        elements.industryFormLevel2Wrap.classList.remove('hidden');
        IndustryManager.fillLevel2(val);
      }
    });

    elements.industryFormLevel2.addEventListener('change', function () {
      if (elements.industryFormLevel2.value === NEW_LEVEL2_VALUE) {
        elements.industryFormNewLevel2Wrap.classList.remove('hidden');
        elements.industryFormNewLevel2.focus();
      } else {
        elements.industryFormNewLevel2Wrap.classList.add('hidden');
        elements.industryFormNewLevel2.value = '';
      }
    });

    elements.industrySelect.addEventListener('change', function () {
      state.currentIndustryId = elements.industrySelect.value || '';
      KnowledgeManager.render();
    });
    elements.btnAddKnowledge.addEventListener('click', function () {
      KnowledgeManager.openModal();
    });
    elements.knowledgeModalCancel.addEventListener('click', function () {
      KnowledgeManager.closeModal();
    });
    elements.knowledgeModalSubmit.addEventListener('click', function () {
      KnowledgeManager.save();
    });
    Modal.bindOverlayClose(elements.knowledgeModal, function () {
      KnowledgeManager.closeModal();
    });
  }

  // ====================== 初始化 ======================
  function init() {
    state.level1Options = MockStore.industryLevel1Options;
    state.level2Map = MockStore.industryLevel2Map;
    
    cacheElements();
    bindEvents();
    IndustryManager.render();
    IndustryManager.fillSelect();
    KnowledgeManager.render();
  }

  // ====================== 导出模块 ======================
  global.IndustryPage = {
    init: init,
    state: state,
    IndustryManager: IndustryManager,
    KnowledgeManager: KnowledgeManager
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
