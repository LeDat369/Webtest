import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,

  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBGumiAbsiQi_m7Ind84-ALwts2k18Rp5g",
  authDomain: "webtest-e7852.firebaseapp.com",
  projectId: "webtest-e7852",
  storageBucket: "webtest-e7852.firebasestorage.app",
  messagingSenderId: "271781052843",
  appId: "1:271781052843:web:61d5dcdd82c87c699552ee",
  measurementId: "G-VXXP78TRYQ",
};

const sheetsEndpoint = "https://webtest-proxy.lvd02082003.workers.dev/";
const sheetsToken = "";
const sheetsEnabled = sheetsEndpoint && !sheetsEndpoint.startsWith("PASTE_");

const adminUids = ["t7TsVaH42oWE6sgOgyzKQY3Pcr53"];
const adminEmails = ["lvd02082003@gmail.com"];

const configMissing = Object.values(firebaseConfig).some((value) =>
  String(value).startsWith("PASTE_")
);
const adminConfigMissing =
  adminUids.every((uid) => String(uid).startsWith("PASTE_") || !uid) &&
  adminEmails.every((email) => String(email).startsWith("PASTE_") || !email);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
const authGate = document.getElementById("auth-gate");
const authForm = document.querySelector("[data-auth-form]");
const authError = document.querySelector("[data-auth-error]");
const authTitle = document.querySelector("[data-auth-title]");
const authSubmit = document.querySelector("[data-auth-submit]");
const authToggle = document.querySelector("[data-auth-toggle]");
const authSwitchText = document.querySelector("[data-auth-switch-text]");
const authConfirm = document.querySelector("[data-auth-confirm]");
const approvalGate = document.querySelector("[data-approval-gate]");
const approvalMessage = document.querySelector("[data-approval-message]");
const protectedEls = document.querySelectorAll("[data-protected]");
const logoutButton = document.querySelector("[data-logout]");
const adminEls = document.querySelectorAll("[data-admin]");
const adminLoadButton = document.querySelector("[data-admin-load]");
const adminSampleButton = document.querySelector("[data-admin-sample]");
const adminSaveButton = document.querySelector("[data-admin-save]");
const adminForm = document.querySelector("[data-admin-form]");
const treeEditorRoot = document.querySelector("[data-tree-editor]");
const treeAddRootButton = document.querySelector("[data-tree-add-root]");
const adminAddButtons = document.querySelectorAll("[data-admin-add]");
const adminStatus = document.querySelector("[data-admin-status]");
const approvalRefresh = document.querySelector("[data-approval-refresh]");
const approvalList = document.querySelector("[data-approval-list]");
const approvalCounts = document.querySelector("[data-approval-counts]");
const approvalFilters = document.querySelectorAll("[data-approval-filter]");

const heroTitle = document.querySelector("[data-hero-title]");
const overviewFields = {
  clan: document.querySelector("[data-overview='clan']"),
  homeland: document.querySelector("[data-overview='homeland']"),
  motto: document.querySelector("[data-overview='motto']"),
  generations: document.querySelector("[data-overview='generations']"),
};
const treeRoot = document.querySelector("[data-tree]");
const membersRoot = document.querySelector("[data-members]");
const timelineRoot = document.querySelector("[data-timeline]");
const galleryRoot = document.querySelector("[data-gallery]");
const contactLink = document.querySelector("[data-contact-email]");
const pageSections = document.querySelectorAll("main .hero, main .section");

let dataLoaded = false;
let currentUser = null;
let treeNodeId = 0;
let draggedNode = null;
let authMode = "login";
let approvalCache = [];
let approvalFilter = "pending";
let autoSaveTimer = null;
let autoSaveRunning = false;
let revealStarted = false;

const viewerCollection = "viewerRequests";

const listConfigs = {
  members: {
    fields: [
      { name: "name", label: "Tên", type: "text" },
      { name: "role", label: "Vai trò", type: "text" },
      { name: "birthYear", label: "Năm sinh", type: "text" },
      { name: "deathYear", label: "Năm mất", type: "text" },
      { name: "bio", label: "Ghi chú", type: "textarea" },
    ],
  },
  timeline: {
    fields: [
      { name: "year", label: "Năm", type: "text" },
      { name: "text", label: "Nội dung", type: "textarea" },
    ],
  },
  gallery: {
    fields: [
      { name: "label", label: "Nhãn", type: "text" },
      { name: "url", label: "URL ảnh", type: "text" },
    ],
  },
};

const showAuthError = (message) => {
  if (!authError) return;
  authError.textContent = message;
  authError.hidden = false;
};

const clearAuthError = () => {
  if (!authError) return;
  authError.textContent = "";
  authError.hidden = true;
};

const setAuthMode = (mode) => {
  authMode = mode;
  if (authTitle) authTitle.textContent = mode === "login" ? "Đăng nhập" : "Đăng ký";
  if (authSubmit) authSubmit.textContent = mode === "login" ? "Đăng nhập" : "Đăng ký";
  if (authSwitchText)
    authSwitchText.textContent =
      mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?";
  if (authToggle) authToggle.textContent = mode === "login" ? "Đăng ký" : "Đăng nhập";
  if (authConfirm) authConfirm.hidden = mode !== "register";
};

const setAdminStatus = (message, isError = false) => {
  if (!adminStatus) return;
  if (!message) {
    adminStatus.textContent = "";
    adminStatus.hidden = true;
    adminStatus.removeAttribute("data-state");
    return;
  }
  adminStatus.textContent = message;
  adminStatus.hidden = false;
  if (isError) {
    adminStatus.setAttribute("data-state", "error");
  } else {
    adminStatus.removeAttribute("data-state");
  }
};

const scheduleAutoSave = () => {
  if (!sheetsEnabled) return;
  if (!currentUser || !isAdminUser(currentUser)) return;
  if (!adminForm) return;

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    if (autoSaveRunning) return;
    autoSaveRunning = true;
    setAdminStatus("Đang đồng bộ lên Google Sheets...");

    try {
      const data = collectAdminFormData();
      await saveFamilyData(data);
      setAdminStatus("Đã đồng bộ Google Sheets.");
    } catch (error) {
      setAdminStatus("Không thể đồng bộ Google Sheets.", true);
    } finally {
      autoSaveRunning = false;
    }
  }, 800);
};

const isAdminUser = (user) => {
  if (!user) return false;
  const uidMatch = adminUids.some(
    (uid) => uid && !String(uid).startsWith("PASTE_") && uid === user.uid
  );
  const email = String(user.email || "").toLowerCase();
  const emailMatch = adminEmails.some(
    (value) =>
      value && !String(value).startsWith("PASTE_") && value.toLowerCase() === email
  );
  return uidMatch || emailMatch;
};

const setProtectedVisible = (isVisible) => {
  protectedEls.forEach((el) => {
    el.hidden = !isVisible;
  });
  if (isVisible) {
    document
      .querySelectorAll(".section, .hero, .site-footer")
      .forEach((section) => section.classList.add("in-view"));
  }
};

const getActiveSectionId = () => {
  const hash = String(window.location.hash || "").replace("#", "");
  return hash || "tong-quan";
};

const setActiveSection = (sectionId) => {
  if (!pageSections.length) return;
  const target = Array.from(pageSections).find(
    (section) => section.id === sectionId
  );
  const active = target || Array.from(pageSections)[0];

  pageSections.forEach((section) => {
    section.classList.toggle("page-hidden", section !== active);
  });
  if (active) active.classList.add("in-view");
};

const setAuthGateVisible = (isVisible) => {
  if (authGate) authGate.hidden = !isVisible;
};

const setLogoutVisible = (isVisible) => {
  if (logoutButton) logoutButton.hidden = !isVisible;
};

const setApprovalGateVisible = (isVisible, message) => {
  if (approvalGate) approvalGate.hidden = !isVisible;
  if (approvalMessage) {
    approvalMessage.textContent =
      message || "Tài khoản của bạn đang chờ admin phê duyệt.";
  }
};

const showAdmin = (isAdmin) => {
  adminEls.forEach((el) => {
    el.hidden = !isAdmin;
  });
  if (!isAdmin) setAdminStatus("");
};

const buildSheetsUrl = () => {
  if (!sheetsEnabled) return "";
  const url = new URL(sheetsEndpoint);
  if (sheetsToken) url.searchParams.set("token", sheetsToken);
  return url.toString();
};

const normalizeFamilyData = (data = {}) => {
  const base = getEmptyFamilyData();
  const treeRows = Array.isArray(data.treeRows) ? data.treeRows : [];
  const tree = Array.isArray(data.tree)
    ? data.tree
    : treeRows.length
    ? buildTreeFromRows(treeRows)
    : base.tree;

  return {
    overview: { ...base.overview, ...(data.overview || {}) },
    contactEmail: data.contactEmail || base.contactEmail,
    tree,
    members: Array.isArray(data.members) ? data.members : base.members,
    timeline: Array.isArray(data.timeline) ? data.timeline : base.timeline,
    gallery: Array.isArray(data.gallery) ? data.gallery : base.gallery,
  };
};

const buildTreeFromRows = (rows = []) => {
  const nodeMap = new Map();
  const roots = [];

  rows.forEach((row, index) => {
    const id = String(row.id || row.ID || `row-${index + 1}`);
    nodeMap.set(id, {
      id,
      parentId: String(row.parentId || row.parentID || row.parent || ""),
      label: String(row.label || row.name || "").trim(),
      order: Number(row.order || row.sort || index + 1) || index + 1,
      children: [],
    });
  });

  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach((child) => sortNodes(child.children));
  };
  sortNodes(roots);

  const stripNode = (node) => ({
    id: node.id,
    label: node.label || "Không tên",
    children: node.children.map(stripNode),
  });

  return roots.map(stripNode);
};

const toTreeRows = (nodes = []) => {
  let counter = 0;
  const rows = [];

  const walk = (list, parentId = "") => {
    list.forEach((node, index) => {
      const id = node.id || `node-${++counter}`;
      const label = String(node.label || node.name || "").trim();
      rows.push({
        id,
        parentId,
        label,
        order: index + 1,
      });

      if (Array.isArray(node.children) && node.children.length > 0) {
        walk(node.children, id);
      }
    });
  };

  walk(nodes);
  return rows;
};

const fetchSheetData = async () => {
  if (!sheetsEnabled) return null;
  const url = buildSheetsUrl();
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error("SHEETS_READ_FAILED");
  }
  return response.json();
};

const saveSheetData = async (data) => {
  if (!sheetsEnabled) return null;
  const url = buildSheetsUrl();
  const payload = {
    ...data,
    treeRows: toTreeRows(data.tree || []),
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("SHEETS_WRITE_FAILED");
  }

  return response.json();
};

const ensureViewerRequest = async (user) => {
  const requestRef = doc(db, viewerCollection, user.uid);
  const snap = await getDoc(requestRef);
  if (snap.exists()) return snap.data();

  const data = {
    email: user.email || "",
    status: "pending",
    createdAt: serverTimestamp(),
  };
  await setDoc(requestRef, data);
  return data;
};

const checkViewerApproval = async (user) => {
  if (isAdminUser(user)) return { approved: true, status: "admin" };

  const data = await ensureViewerRequest(user);
  const status = data.status || "pending";
  const approved = status === "approved";
  return { approved, status };
};

const getApprovalLabel = (status) => {
  switch (status) {
    case "approved":
      return "Đã duyệt";
    case "rejected":
      return "Từ chối";
    default:
      return "Chờ duyệt";
  }
};

const formatApprovalCounts = (items) => {
  if (!approvalCounts) return;
  const counts = items.reduce(
    (acc, item) => {
      const status = item.status || "pending";
      if (status === "approved") acc.approved += 1;
      else if (status === "rejected") acc.rejected += 1;
      else acc.pending += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );

  approvalCounts.textContent = `Chờ duyệt: ${counts.pending} | Đã duyệt: ${counts.approved} | Từ chối: ${counts.rejected}`;
};

const setApprovalFilter = (value) => {
  approvalFilter = value;
  approvalFilters.forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.getAttribute("data-approval-filter") === value
    );
  });
  renderApprovalList(approvalCache);
};

const updateApprovalStatus = async (id, status) => {
  try {
    await updateDoc(doc(db, viewerCollection, id), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser?.uid || "",
    });
    loadApprovalRequests();
  } catch (error) {
    setAdminStatus("Không thể cập nhật trạng thái tài khoản.", true);
  }
};

const renderApprovalList = (items) => {
  if (!approvalList) return;
  const filtered = items.filter((item) =>
    approvalFilter ? (item.status || "pending") === approvalFilter : true
  );
  approvalList.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-note";
    empty.textContent = "Không có tài khoản trong mục này.";
    approvalList.appendChild(empty);
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement("div");
    row.className = "approval-item";

    const meta = document.createElement("div");
    meta.className = "approval-meta";

    const email = document.createElement("strong");
    email.textContent = item.email || "(không có email)";

    const uid = document.createElement("span");
    uid.textContent = `UID: ${item.id}`;

    const status = document.createElement("span");
    status.className = "approval-status";
    status.setAttribute("data-status", item.status || "pending");
    status.textContent = getApprovalLabel(item.status || "pending");

    meta.append(email, uid, status);

    const actions = document.createElement("div");
    actions.className = "approval-actions";

    if (item.status === "approved") {
      const revoke = document.createElement("button");
      revoke.type = "button";
      revoke.className = "tree-node-btn";
      revoke.textContent = "Thu hồi";
      revoke.addEventListener("click", () => updateApprovalStatus(item.id, "rejected"));
      actions.appendChild(revoke);
    } else if (item.status === "rejected") {
      const reapprove = document.createElement("button");
      reapprove.type = "button";
      reapprove.className = "tree-node-btn";
      reapprove.textContent = "Duyệt lại";
      reapprove.addEventListener("click", () => updateApprovalStatus(item.id, "approved"));
      actions.appendChild(reapprove);
    } else {
      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "tree-node-btn";
      approve.textContent = "Duyệt";
      approve.addEventListener("click", () => updateApprovalStatus(item.id, "approved"));

      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "tree-node-btn";
      reject.textContent = "Từ chối";
      reject.addEventListener("click", () => updateApprovalStatus(item.id, "rejected"));

      actions.append(approve, reject);
    }
    row.append(meta, actions);
    approvalList.appendChild(row);
  });
};

const loadApprovalRequests = async () => {
  if (!currentUser || !isAdminUser(currentUser)) return;
  if (!approvalList) return;

  try {
    const snapshot = await getDocs(collection(db, viewerCollection));
    const items = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));
    approvalCache = items;
    formatApprovalCounts(items);
    renderApprovalList(items);
  } catch (error) {
    setAdminStatus("Không thể tải danh sách duyệt.", true);
  }
};

const getEmptyFamilyData = () => ({
  overview: {
    title: "Gia phả tộc DAT369",
    clan: "Chưa có dữ liệu",
    homeland: "Chưa có dữ liệu",
    motto: "Chưa có dữ liệu",
    generations: "Chưa có dữ liệu",
  },
  tree: [],
  members: [],
  timeline: [],
  gallery: [],
  contactEmail: "",
});

const getSampleFamilyData = () => ({
  overview: {
    title: "Gia phả tộc DAT369",
    clan: "Nguyen",
    homeland: "Nam Bộ",
    motto: "Trong nghĩa, giữ tín, yêu thương",
    generations: "4 thế hệ",
  },
  contactEmail: "dat369@example.com",
  tree: [
    {
      id: "A1",
      label: "Cụ tổ: Nguyễn Văn A (1890 - 1970)",
      children: [
        {
          id: "B1",
          label: "Ông tổ: Nguyễn Văn B (1915 - 1990)",
          children: [
            {
              id: "C1",
              label: "Cha: Nguyễn Văn C (1940 - 2010)",
              children: [
                { id: "D1", label: "Con: Nguyễn Văn D (1965 - )" },
                { id: "D2", label: "Con: Nguyễn Văn E (1968 - )" },
              ],
            },
            {
              id: "C2",
              label: "Cô: Nguyễn Thị F (1943 - )",
              children: [{ id: "D3", label: "Con: Nguyễn Thị G (1970 - )" }],
            },
          ],
        },
        {
          id: "B2",
          label: "Ông tổ: Nguyễn Văn H (1920 - 2005)",
          children: [{ id: "C3", label: "Cha: Nguyễn Văn I (1950 - )" }],
        },
      ],
    },
  ],
  members: [
    {
      name: "Nguyễn Văn A",
      role: "Cụ tổ",
      birthYear: "1890",
      deathYear: "1970",
      bio: "Lập nghiệp, xây dựng nền nếp nhà, khởi đầu phát triển dòng họ.",
    },
    {
      name: "Nguyễn Văn B",
      role: "Ông tổ",
      birthYear: "1915",
      deathYear: "1990",
      bio: "Giữ gia phong, dạy con cháu nên người.",
    },
    {
      name: "Nguyễn Thị F",
      role: "Cô",
      birthYear: "1943",
      bio: "Quản lý việc nhà và giữ kết nối các nhánh họ.",
    },
  ],
  timeline: [
    { year: "1890", text: "Cụ tổ Nguyễn Văn A chào đời." },
    { year: "1938", text: "Gia tộc chuyển đến vùng định cư hiện nay." },
    { year: "1975", text: "Hoàn thành nhà từ đường đầu tiên." },
    { year: "2026", text: "Hoàn thiện website gia phả DAT369." },
  ],
  gallery: [
    { label: "Ảnh tưởng nhớ", url: "" },
    { label: "Nhà từ đường", url: "" },
    { label: "Hoạt động họ hàng", url: "" },
  ],
});

const nextTreeId = () => {
  treeNodeId += 1;
  return `tree-node-${treeNodeId}`;
};

const canDropNode = (targetNode) => {
  if (!draggedNode) return false;
  if (!targetNode) return true;
  if (draggedNode === targetNode) return false;
  if (draggedNode.contains(targetNode)) return false;
  return true;
};

const createTreeNode = (label = "", persistId = "") => {
  const node = document.createElement("li");
  node.className = "tree-node";
  node.dataset.nodeId = nextTreeId();
  node.dataset.persistId = persistId || "";

  const row = document.createElement("div");
  row.className = "tree-node-row";

  const handle = document.createElement("span");
  handle.className = "tree-node-handle";
  handle.textContent = "Kéo";
  handle.setAttribute("draggable", "true");
  handle.setAttribute("title", "Kéo thả");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "tree-node-input";
  input.placeholder = "Nhãn nút";
  input.value = label;
  input.addEventListener("input", () => scheduleAutoSave());

  const actions = document.createElement("div");
  actions.className = "tree-node-actions";

  const addChild = document.createElement("button");
  addChild.type = "button";
  addChild.className = "tree-node-btn";
  addChild.textContent = "Thêm con";

  const moveUp = document.createElement("button");
  moveUp.type = "button";
  moveUp.className = "tree-node-btn";
  moveUp.textContent = "Lên";

  const moveDown = document.createElement("button");
  moveDown.type = "button";
  moveDown.className = "tree-node-btn";
  moveDown.textContent = "Xuống";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "tree-node-btn";
  remove.textContent = "Xóa";

  actions.append(addChild, moveUp, moveDown, remove);
  row.append(handle, input, actions);

  const children = document.createElement("ul");
  children.className = "tree-node-children";

  addChild.addEventListener("click", () => {
    children.appendChild(createTreeNode());
    scheduleAutoSave();
  });

  remove.addEventListener("click", () => {
    node.remove();
    scheduleAutoSave();
  });

  moveUp.addEventListener("click", () => {
    const prev = node.previousElementSibling;
    if (prev && node.parentElement) {
      node.parentElement.insertBefore(node, prev);
      scheduleAutoSave();
    }
  });

  moveDown.addEventListener("click", () => {
    const next = node.nextElementSibling;
    if (next && node.parentElement) {
      node.parentElement.insertBefore(next, node);
      scheduleAutoSave();
    }
  });

  handle.addEventListener("dragstart", (event) => {
    draggedNode = node;
    node.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.dataset.nodeId || "");
  });

  handle.addEventListener("dragend", () => {
    node.classList.remove("dragging");
    draggedNode = null;
  });

  row.addEventListener("dragover", (event) => {
    if (!canDropNode(node)) return;
    event.preventDefault();
    event.stopPropagation();
    row.classList.add("drag-over");
  });

  row.addEventListener("dragleave", () => {
    row.classList.remove("drag-over");
  });

  row.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    row.classList.remove("drag-over");
    if (!canDropNode(node)) return;
    children.appendChild(draggedNode);
    scheduleAutoSave();
  });

  children.addEventListener("dragover", (event) => {
    if (!canDropNode(node)) return;
    event.preventDefault();
    event.stopPropagation();
    children.classList.add("drag-over");
  });

  children.addEventListener("dragleave", () => {
    children.classList.remove("drag-over");
  });

  children.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    children.classList.remove("drag-over");
    if (!canDropNode(node)) return;
    children.appendChild(draggedNode);
    scheduleAutoSave();
  });

  node.append(row, children);
  return node;
};

const buildTreeEditor = (nodes, parent) => {
  nodes.forEach((node) => {
    const treeNode = createTreeNode(node.label || node.name || "", node.id || "");
    parent.appendChild(treeNode);

    if (Array.isArray(node.children) && node.children.length > 0) {
      const childrenRoot = treeNode.querySelector(".tree-node-children");
      buildTreeEditor(node.children, childrenRoot);
    }
  });
};

const populateTreeEditor = (nodes = []) => {
  if (!treeEditorRoot) return;
  treeEditorRoot.innerHTML = "";

  if (!Array.isArray(nodes) || nodes.length === 0) {
    treeEditorRoot.appendChild(createTreeNode());
    return;
  }

  buildTreeEditor(nodes, treeEditorRoot);
};

const serializeTreeNode = (node) => {
  const input = node.querySelector(".tree-node-input");
  const label = String(input?.value || "").trim();
  const persistId = String(node.dataset.persistId || "").trim();
  const childrenRoot = node.querySelector(".tree-node-children");
  const children = childrenRoot
    ? [...childrenRoot.children]
        .map((child) => serializeTreeNode(child))
        .filter(Boolean)
    : [];

  if (!label && children.length === 0) return null;

  return {
    id: persistId || "",
    label: label || "Không tên",
    children,
  };
};

const collectTreeEditor = () => {
  if (!treeEditorRoot) return [];
  return [...treeEditorRoot.children]
    .map((node) => serializeTreeNode(node))
    .filter(Boolean);
};

const getAdminListRoot = (key) =>
  document.querySelector(`[data-list='${key}']`);

const createListItem = (key, values = {}) => {
  const config = listConfigs[key];
  if (!config) return null;

  const item = document.createElement("div");
  item.className = "admin-item";
  item.setAttribute("data-item", key);

  config.fields.forEach((field) => {
    const label = document.createElement("label");
    label.append(document.createTextNode(field.label));

    let input = null;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = field.type;
    }

    input.setAttribute("data-field", field.name);
    input.value = values[field.name] || "";
    input.addEventListener("input", () => scheduleAutoSave());

    label.appendChild(input);
    item.appendChild(label);
  });

  const actions = document.createElement("div");
  actions.className = "admin-item-actions";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "admin-remove";
  remove.textContent = "Xóa";
  remove.addEventListener("click", () => {
    item.remove();
    scheduleAutoSave();
  });

  actions.appendChild(remove);
  item.appendChild(actions);

  return item;
};

const populateList = (key, items = []) => {
  const root = getAdminListRoot(key);
  if (!root) return;
  root.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const emptyItem = createListItem(key);
    if (emptyItem) root.appendChild(emptyItem);
    return;
  }

  items.forEach((item) => {
    const row = createListItem(key, item);
    if (row) root.appendChild(row);
  });
};

const collectListData = (key) => {
  const root = getAdminListRoot(key);
  if (!root) return [];
  const config = listConfigs[key];
  if (!config) return [];

  const items = [...root.querySelectorAll("[data-item]")].map((item) => {
    const entry = {};
    config.fields.forEach((field) => {
      const input = item.querySelector(`[data-field='${field.name}']`);
      entry[field.name] = input ? String(input.value || "").trim() : "";
    });
    return entry;
  });

  return items.filter((item) => Object.values(item).some((value) => value));
};

const setAdminField = (key, value) => {
  if (!adminForm) return;
  const input = adminForm.querySelector(`[data-field='${key}']`);
  if (input) input.value = value || "";
};

const getAdminField = (key) => {
  if (!adminForm) return "";
  const input = adminForm.querySelector(`[data-field='${key}']`);
  return input ? String(input.value || "").trim() : "";
};

const populateAdminForm = (data) => {
  setAdminField("overview.title", data?.overview?.title || "");
  setAdminField("overview.clan", data?.overview?.clan || "");
  setAdminField("overview.homeland", data?.overview?.homeland || "");
  setAdminField("overview.motto", data?.overview?.motto || "");
  setAdminField("overview.generations", data?.overview?.generations || "");
  setAdminField("contactEmail", data?.contactEmail || "");

  populateTreeEditor(data?.tree || []);
  populateList("members", data?.members || []);
  populateList("timeline", data?.timeline || []);
  populateList("gallery", data?.gallery || []);
};

const collectAdminFormData = () => {
  return {
    overview: {
      title: getAdminField("overview.title") || "Gia phả tộc DAT369",
      clan: getAdminField("overview.clan"),
      homeland: getAdminField("overview.homeland"),
      motto: getAdminField("overview.motto"),
      generations: getAdminField("overview.generations"),
    },
    contactEmail: getAdminField("contactEmail"),
    tree: collectTreeEditor(),
    members: collectListData("members"),
    timeline: collectListData("timeline"),
    gallery: collectListData("gallery"),
  };
};

const buildTree = (nodes, parent) => {
  nodes.forEach((node) => {
    const li = document.createElement("li");
    const card = document.createElement("div");
    card.className = "tree-card";
    card.textContent = node.label || node.name || "";
    li.appendChild(card);

    if (Array.isArray(node.children) && node.children.length > 0) {
      const ul = document.createElement("ul");
      buildTree(node.children, ul);
      li.appendChild(ul);
    }

    parent.appendChild(li);
  });
};

const renderMembers = (members) => {
  membersRoot.innerHTML = "";
  members.forEach((member) => {
    const card = document.createElement("article");
    card.className = "card";

    const name = document.createElement("h3");
    name.textContent = member.name || "";

    const role = document.createElement("p");
    role.className = "role";
    role.textContent = member.role || "";

    const meta = document.createElement("p");
    meta.className = "member-meta";
    const birth = String(member.birthYear || "").trim();
    const death = String(member.deathYear || "").trim();
    meta.textContent = birth || death ? `${birth || "?"} - ${death || ""}` : "";

    const bio = document.createElement("p");
    bio.textContent = member.bio || "";

    card.append(name, role);
    if (meta.textContent) card.append(meta);
    if (bio.textContent) card.append(bio);
    membersRoot.appendChild(card);
  });
};

const renderTimeline = (events) => {
  timelineRoot.innerHTML = "";
  events.forEach((event) => {
    const item = document.createElement("div");
    item.className = "timeline-item";

    const year = document.createElement("span");
    year.textContent = event.year || "";

    const text = document.createElement("p");
    text.textContent = event.text || "";

    item.append(year, text);
    timelineRoot.appendChild(item);
  });
};

const renderGallery = (items) => {
  galleryRoot.innerHTML = "";
  items.forEach((item) => {
    const tile = document.createElement("div");
    tile.className = "photo";
    tile.textContent = item.label || "Ảnh";

    if (item.url) {
      tile.style.backgroundImage = `url(${item.url})`;
      tile.style.backgroundSize = "cover";
      tile.style.backgroundPosition = "center";
      tile.style.color = "#fff";
      tile.style.textShadow = "0 2px 8px rgba(0,0,0,0.45)";
    }

    galleryRoot.appendChild(tile);
  });
};

const renderOverview = (overview = {}) => {
  if (heroTitle && overview.title) heroTitle.textContent = overview.title;
  if (overviewFields.clan) overviewFields.clan.textContent = overview.clan || "";
  if (overviewFields.homeland)
    overviewFields.homeland.textContent = overview.homeland || "";
  if (overviewFields.motto) overviewFields.motto.textContent = overview.motto || "";
  if (overviewFields.generations)
    overviewFields.generations.textContent = overview.generations || "";
};

const renderContent = (data) => {
  renderOverview(data.overview || {});

  if (treeRoot) {
    treeRoot.innerHTML = "";
    if (Array.isArray(data.tree)) {
      buildTree(data.tree, treeRoot);
    }
  }

  if (membersRoot && Array.isArray(data.members)) {
    renderMembers(data.members);
  }

  if (timelineRoot && Array.isArray(data.timeline)) {
    renderTimeline(data.timeline);
  }

  if (galleryRoot && Array.isArray(data.gallery)) {
    renderGallery(data.gallery);
  }

  if (contactLink) {
    const email = data.contactEmail || "";
    if (email) {
      contactLink.href = `mailto:${email}`;
      contactLink.textContent = "Liên hệ";
    } else {
      contactLink.href = "#";
      contactLink.textContent = "Cập nhật liên hệ";
    }
  }
};

const startReveal = () => {
  if (revealStarted) return;
  revealStarted = true;

  const observers = document.querySelectorAll(".section, .hero, .site-footer");

  if (typeof IntersectionObserver === "undefined") {
    observers.forEach((section) => section.classList.add("in-view"));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  observers.forEach((section) => io.observe(section));

  // Fallback: ensure content is visible if observers do not fire.
  setTimeout(() => {
    observers.forEach((section) => section.classList.add("in-view"));
  }, 800);
};

const saveFamilyData = async (data) => {
  if (sheetsEnabled) {
    await saveSheetData(data);
    return;
  }

  await setDoc(doc(db, "familyTrees", "main"), data);
};

const loadFamilyData = async () => {
  if (sheetsEnabled) {
    try {
      const raw = await fetchSheetData();
      const data = normalizeFamilyData(raw || {});
      renderContent(data);
      return data;
    } catch (error) {
      console.error("Sheets load failed", error);
      const data = getEmptyFamilyData();
      renderContent(data);
      return data;
    }
  }

  try {
    const docRef = doc(db, "familyTrees", "main");
    const snap = await getDoc(docRef);
    const data = snap.exists() ? normalizeFamilyData(snap.data()) : getEmptyFamilyData();

    renderContent(data);
    return data;
  } catch (error) {
    console.error("Firestore load failed", error);
    const data = getEmptyFamilyData();
    renderContent(data);
    return data;
  }
};

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

if (treeEditorRoot) {
  treeEditorRoot.addEventListener("dragover", (event) => {
    if (!canDropNode(null)) return;
    event.preventDefault();
    treeEditorRoot.classList.add("drag-over");
  });

  treeEditorRoot.addEventListener("dragleave", () => {
    treeEditorRoot.classList.remove("drag-over");
  });

  treeEditorRoot.addEventListener("drop", (event) => {
    event.preventDefault();
    treeEditorRoot.classList.remove("drag-over");
    if (!canDropNode(null)) return;
    treeEditorRoot.appendChild(draggedNode);
    scheduleAutoSave();
  });
}

if (treeAddRootButton) {
  treeAddRootButton.addEventListener("click", () => {
    if (treeEditorRoot) treeEditorRoot.appendChild(createTreeNode());
    scheduleAutoSave();
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => signOut(auth));
}

if (authToggle) {
  authToggle.addEventListener("click", () => {
    setAuthMode(authMode === "login" ? "register" : "login");
    clearAuthError();
  });
}

if (adminLoadButton) {
  adminLoadButton.addEventListener("click", async () => {
    if (!currentUser || !isAdminUser(currentUser)) {
      setAdminStatus("Bạn không có quyền admin.", true);
      return;
    }

    setAdminStatus("Đang tải dữ liệu...");

    try {
      const data = await loadFamilyData();
      populateAdminForm(data);
      setAdminStatus("Đã tải dữ liệu.");
    } catch (error) {
      setAdminStatus("Không thể tải dữ liệu. Vui lòng thử lại.", true);
    }
  });
}

if (adminSampleButton) {
  adminSampleButton.addEventListener("click", () => {
    if (!currentUser || !isAdminUser(currentUser)) {
      setAdminStatus("Bạn không có quyền admin.", true);
      return;
    }

    const data = getSampleFamilyData();
    populateAdminForm(data);
    renderContent(data);
    setAdminStatus("Đã nạp dữ liệu mẫu. Bấm Lưu thay đổi để ghi vào Sheets.");
    scheduleAutoSave();
  });
}

if (adminSaveButton) {
  adminSaveButton.addEventListener("click", async () => {
    if (!currentUser || !isAdminUser(currentUser)) {
      setAdminStatus("Bạn không có quyền admin.", true);
      return;
    }

    if (configMissing) {
      setAdminStatus("Cần cập nhật firebaseConfig trong script.js.", true);
      return;
    }

    let data = null;
    try {
      data = collectAdminFormData();
    } catch (error) {
      setAdminStatus("Không thể đọc dữ liệu form.", true);
      return;
    }

    setAdminStatus("Đang lưu dữ liệu...");

    try {
      await saveFamilyData(data);
      renderContent(data);
      setAdminStatus(
        sheetsEnabled
          ? "Đã lưu dữ liệu lên Google Sheets."
          : "Đã lưu dữ liệu."
      );
    } catch (error) {
      setAdminStatus("Không thể lưu dữ liệu. Vui lòng thử lại.", true);
    }
  });
}

adminAddButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.getAttribute("data-admin-add");
    if (!key) return;
    const root = getAdminListRoot(key);
    const item = createListItem(key);
    if (root && item) root.appendChild(item);
    scheduleAutoSave();
  });
});

if (adminForm) {
  adminForm.addEventListener("submit", (event) => event.preventDefault());
  adminForm.addEventListener("input", () => scheduleAutoSave());
}

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthError();

    if (configMissing) {
      showAuthError("Cần cập nhật firebaseConfig trong script.js.");
      return;
    }

    const formData = new FormData(authForm);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    try {
      if (authMode === "register") {
        const confirm = String(formData.get("confirm") || "");
        if (!confirm || confirm !== password) {
          showAuthError("Mật khẩu xác nhận không trùng khớp.");
          return;
        }

        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(doc(db, viewerCollection, credential.user.uid), {
          email,
          status: "pending",
          createdAt: serverTimestamp(),
        });
        showAuthError("Đăng ký thành công. Tài khoản đang chờ duyệt.");
        return;
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      showAuthError("Đăng nhập hoặc đăng ký thất bại. Vui lòng thử lại.");
    }
  });
}

if (configMissing) {
  showAuthError("Cần cập nhật firebaseConfig trong script.js.");
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  if (user) {
    setAuthGateVisible(false);
    setLogoutVisible(true);

    const isAdmin = isAdminUser(user);
    showAdmin(isAdmin);

    if (isAdmin && adminConfigMissing) {
      setAdminStatus("Cần cập nhật admin UID hoặc email trong script.js.", true);
    }

    const approval = await checkViewerApproval(user);
    if (approval.approved) {
      setProtectedVisible(true);
      setApprovalGateVisible(false);
      startReveal();

      if (!dataLoaded) {
        dataLoaded = true;
        const data = await loadFamilyData();
        if (isAdmin) {
          populateAdminForm(data);
          loadApprovalRequests();
        }
      } else if (isAdmin) {
        loadApprovalRequests();
      }
    } else {
      setProtectedVisible(false);
      const message =
        approval.status === "rejected"
          ? "Tài khoản đã bị từ chối. Vui lòng liên hệ admin."
          : "Tài khoản của bạn đang chờ admin phê duyệt.";
      setApprovalGateVisible(true, message);
    }
  } else {
    setAuthGateVisible(true);
    setProtectedVisible(false);
    setApprovalGateVisible(false);
    setLogoutVisible(false);
    showAdmin(false);
  }
});

if (approvalRefresh) {
  approvalRefresh.addEventListener("click", () => loadApprovalRequests());
}

approvalFilters.forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.getAttribute("data-approval-filter");
    if (value) setApprovalFilter(value);
  });
});

setAuthMode("login");
setApprovalFilter("pending");
setActiveSection(getActiveSectionId());

window.addEventListener("hashchange", () => {
  setActiveSection(getActiveSectionId());
});
