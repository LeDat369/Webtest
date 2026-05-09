import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_AUTH_DOMAIN",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID",
};

const adminUids = ["PASTE_ADMIN_UID"];
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
const protectedEls = document.querySelectorAll("[data-protected]");
const logoutButton = document.querySelector("[data-logout]");
const adminEls = document.querySelectorAll("[data-admin]");
const adminLoadButton = document.querySelector("[data-admin-load]");
const adminSaveButton = document.querySelector("[data-admin-save]");
const adminForm = document.querySelector("[data-admin-form]");
const treeEditorRoot = document.querySelector("[data-tree-editor]");
const treeAddRootButton = document.querySelector("[data-tree-add-root]");
const adminAddButtons = document.querySelectorAll("[data-admin-add]");
const adminStatus = document.querySelector("[data-admin-status]");

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

let dataLoaded = false;
let currentUser = null;
let treeNodeId = 0;
let draggedNode = null;

const listConfigs = {
  members: {
    fields: [
      { name: "name", label: "Ten", type: "text" },
      { name: "role", label: "Vai tro", type: "text" },
      { name: "bio", label: "Mo ta", type: "textarea" },
    ],
  },
  timeline: {
    fields: [
      { name: "year", label: "Nam", type: "text" },
      { name: "text", label: "Noi dung", type: "textarea" },
    ],
  },
  gallery: {
    fields: [
      { name: "label", label: "Nhan", type: "text" },
      { name: "url", label: "URL anh", type: "text" },
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

const toggleProtected = (isVisible) => {
  protectedEls.forEach((el) => {
    el.hidden = !isVisible;
  });
  if (authGate) authGate.hidden = isVisible;
  if (logoutButton) logoutButton.hidden = !isVisible;
};

const showAdmin = (isAdmin) => {
  adminEls.forEach((el) => {
    el.hidden = !isAdmin;
  });
  if (!isAdmin) setAdminStatus("");
};

const getEmptyFamilyData = () => ({
  overview: {
    title: "Gia pha toc DAT369",
    clan: "Chua co du lieu",
    homeland: "Chua co du lieu",
    motto: "Chua co du lieu",
    generations: "Chua co du lieu",
  },
  tree: [],
  members: [],
  timeline: [],
  gallery: [],
  contactEmail: "",
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

const createTreeNode = (label = "") => {
  const node = document.createElement("li");
  node.className = "tree-node";
  node.dataset.nodeId = nextTreeId();

  const row = document.createElement("div");
  row.className = "tree-node-row";

  const handle = document.createElement("span");
  handle.className = "tree-node-handle";
  handle.textContent = "Keo";
  handle.setAttribute("draggable", "true");
  handle.setAttribute("title", "Keo tha");

  const input = document.createElement("input");
  input.type = "text";
  input.className = "tree-node-input";
  input.placeholder = "Nhan nut";
  input.value = label;

  const actions = document.createElement("div");
  actions.className = "tree-node-actions";

  const addChild = document.createElement("button");
  addChild.type = "button";
  addChild.className = "tree-node-btn";
  addChild.textContent = "Them con";

  const moveUp = document.createElement("button");
  moveUp.type = "button";
  moveUp.className = "tree-node-btn";
  moveUp.textContent = "Len";

  const moveDown = document.createElement("button");
  moveDown.type = "button";
  moveDown.className = "tree-node-btn";
  moveDown.textContent = "Xuong";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "tree-node-btn";
  remove.textContent = "Xoa";

  actions.append(addChild, moveUp, moveDown, remove);
  row.append(handle, input, actions);

  const children = document.createElement("ul");
  children.className = "tree-node-children";

  addChild.addEventListener("click", () => {
    children.appendChild(createTreeNode());
  });

  remove.addEventListener("click", () => {
    node.remove();
  });

  moveUp.addEventListener("click", () => {
    const prev = node.previousElementSibling;
    if (prev && node.parentElement) {
      node.parentElement.insertBefore(node, prev);
    }
  });

  moveDown.addEventListener("click", () => {
    const next = node.nextElementSibling;
    if (next && node.parentElement) {
      node.parentElement.insertBefore(next, node);
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
  });

  node.append(row, children);
  return node;
};

const buildTreeEditor = (nodes, parent) => {
  nodes.forEach((node) => {
    const treeNode = createTreeNode(node.label || node.name || "");
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
  const childrenRoot = node.querySelector(".tree-node-children");
  const children = childrenRoot
    ? [...childrenRoot.children]
        .map((child) => serializeTreeNode(child))
        .filter(Boolean)
    : [];

  if (!label && children.length === 0) return null;

  return {
    label: label || "Khong ten",
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

    label.appendChild(input);
    item.appendChild(label);
  });

  const actions = document.createElement("div");
  actions.className = "admin-item-actions";

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "admin-remove";
  remove.textContent = "Xoa";
  remove.addEventListener("click", () => item.remove());

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
      title: getAdminField("overview.title") || "Gia pha toc DAT369",
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
    const span = document.createElement("span");
    span.textContent = node.label || node.name || "";
    li.appendChild(span);

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

    const bio = document.createElement("p");
    bio.textContent = member.bio || "";

    card.append(name, role, bio);
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
    tile.textContent = item.label || "Anh";

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
      contactLink.textContent = "Lien he";
    } else {
      contactLink.href = "#";
      contactLink.textContent = "Cap nhat lien he";
    }
  }
};

const startReveal = () => {
  const observers = document.querySelectorAll(".section, .hero, .site-footer");
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
};

const loadFamilyData = async () => {
  const docRef = doc(db, "familyTrees", "main");
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : getEmptyFamilyData();

  renderContent(data);
  return data;
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
  });
}

if (treeAddRootButton) {
  treeAddRootButton.addEventListener("click", () => {
    if (treeEditorRoot) treeEditorRoot.appendChild(createTreeNode());
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => signOut(auth));
}

if (adminLoadButton) {
  adminLoadButton.addEventListener("click", async () => {
    if (!currentUser || !isAdminUser(currentUser)) {
      setAdminStatus("Ban khong co quyen admin.", true);
      return;
    }

    setAdminStatus("Dang tai du lieu...");

    try {
      const data = await loadFamilyData();
      populateAdminForm(data);
      setAdminStatus("Da tai du lieu.");
    } catch (error) {
      setAdminStatus("Khong the tai du lieu. Vui long thu lai.", true);
    }
  });
}

if (adminSaveButton) {
  adminSaveButton.addEventListener("click", async () => {
    if (!currentUser || !isAdminUser(currentUser)) {
      setAdminStatus("Ban khong co quyen admin.", true);
      return;
    }

    if (configMissing) {
      setAdminStatus("Can cap nhat firebaseConfig trong script.js.", true);
      return;
    }

    let data = null;
    try {
      data = collectAdminFormData();
    } catch (error) {
      setAdminStatus("Khong the doc du lieu form.", true);
      return;
    }

    setAdminStatus("Dang luu du lieu...");

    try {
      await setDoc(doc(db, "familyTrees", "main"), data);
      renderContent(data);
      setAdminStatus("Da luu du lieu.");
    } catch (error) {
      setAdminStatus("Khong the luu du lieu. Vui long thu lai.", true);
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
  });
});

if (adminForm) {
  adminForm.addEventListener("submit", (event) => event.preventDefault());
}

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearAuthError();

    if (configMissing) {
      showAuthError("Can cap nhat firebaseConfig trong script.js.");
      return;
    }

    const formData = new FormData(authForm);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      showAuthError("Dang nhap that bai. Vui long kiem tra email va mat khau.");
    }
  });
}

if (configMissing) {
  showAuthError("Can cap nhat firebaseConfig trong script.js.");
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  if (user) {
    toggleProtected(true);
    const isAdmin = isAdminUser(user);
    showAdmin(isAdmin);

    if (isAdmin && adminConfigMissing) {
      setAdminStatus("Can cap nhat admin UID hoac email trong script.js.", true);
    }

    if (!dataLoaded) {
      dataLoaded = true;
      const data = await loadFamilyData();
      startReveal();
      if (isAdmin) {
        populateAdminForm(data);
      }
    }
  } else {
    toggleProtected(false);
    showAdmin(false);
  }
});
