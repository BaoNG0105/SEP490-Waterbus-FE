import {
    getPublishedBlogPosts as apiGetPublishedBlogPosts,
    getBlogPostBySlug as apiGetBlogPostBySlug,
    getBlogPostsManagement as apiGetBlogPostsManagement,
    getBlogPostManagementById as apiGetBlogPostManagementById,
    createBlogPost as apiCreateBlogPost,
    updateBlogPost as apiUpdateBlogPost,
    updateBlogPostStatus as apiUpdateBlogPostStatus,
    deleteBlogPost as apiDeleteBlogPost,
} from '../api/blogApi';

export const BLOG_STATUS = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
};

export const BLOG_CATEGORY = {
    EVENT: 'Event',
    NEWS: 'News',
};

/** Chỉ News | Event — map Activity cũ → News. */
export const normalizeBlogCategory = (category) => {
    const key = String(category || '').trim();
    if (key === BLOG_CATEGORY.EVENT || key.toLowerCase() === 'event') return BLOG_CATEGORY.EVENT;
    return BLOG_CATEGORY.NEWS;
};

export const labelBlogCategory = (category, lang = 'VN') => {
    const key = normalizeBlogCategory(category);
    const isVn = lang === 'VN';
    if (key === BLOG_CATEGORY.NEWS) return isVn ? 'Tin tức' : 'News';
    if (key === BLOG_CATEGORY.EVENT) return isVn ? 'Sự kiện' : 'Event';
    return key || '—';
};

export const labelBlogStatus = (status, lang = 'VN') => {
    const key = String(status || '');
    const isVn = lang === 'VN';
    if (key === BLOG_STATUS.DRAFT) return isVn ? 'Nháp' : 'Draft';
    if (key === BLOG_STATUS.PUBLISHED) return isVn ? 'Đã xuất bản' : 'Published';
    return key || '—';
};

const extractRows = (data) => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    return [];
};

/** Thu thập imageUrls[] (ưu tiên), fallback imageUrl cũ. */
export const collectBlogImageUrls = (item) => {
    const urls = [];
    const push = (value) => {
        const s = String(value || "").trim();
        if (s && !urls.includes(s)) urls.push(s);
    };
    if (Array.isArray(item?.imageUrls)) item.imageUrls.forEach(push);
    push(item?.imageUrl);
    return urls;
};

export const getBlogCoverUrl = (item) => collectBlogImageUrls(item)[0] || "";

/** Nội dung form admin: contentText → content → strip contentHtml. */
export const getBlogEditableContent = (item) => {
    if (!item) return "";
    const text = item.contentText ?? item.ContentText;
    if (text != null && String(text).trim().length) return String(text);
    const plain = item.content ?? item.Content;
    if (plain != null && String(plain).trim().length && !String(plain).includes("<")) {
        return String(plain);
    }
    // content có thể là HTML legacy
    if (plain != null && String(plain).trim().length && String(plain).includes("<")) {
        return String(plain)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim();
    }
    const html = item.contentHtml ?? item.ContentHtml;
    if (html) {
        return String(html)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim();
    }
    // description / body fallback nếu BE đặt tên khác
    const fallback = item.description ?? item.body ?? item.Body ?? "";
    return fallback ? String(fallback) : "";
};

/** HTML hiển thị public: contentHtml → content (legacy HTML). */
export const getBlogDisplayHtml = (item) => {
    if (!item) return "";
    if (item.contentHtml) return String(item.contentHtml);
    if (item.content) return String(item.content);
    return "";
};

const normalizeBlogPost = (item) => {
    if (!item) return null;
    const imageUrls = collectBlogImageUrls(item);
    const contentText = getBlogEditableContent(item);
    const rawStatus = String(item.status || BLOG_STATUS.DRAFT);
    // Archived cũ → coi như Draft trên UI (BE không còn trả Archived).
    const status = rawStatus === 'Archived' ? BLOG_STATUS.DRAFT : rawStatus;
    return {
        ...item,
        id: String(item.blogPostId ?? item.id ?? ''),
        title: item.title || '',
        slug: item.slug || '',
        summary: item.summary || '',
        category: normalizeBlogCategory(item.category),
        imageUrls,
        imageUrl: imageUrls[0] || '',
        imageAltText: item.imageAltText || '',
        content: contentText,
        contentText,
        contentHtml: item.contentHtml || (item.content && String(item.content).includes("<") ? item.content : "") || "",
        status,
        publishedAt: item.publishedAt || null,
        createdAt: item.createdAt || null,
        updatedAt: item.updatedAt || null,
    };
};

// Service: Lấy danh sách blog posts đã xuất bản (Status = Published)
export const fetchPublishedBlogPosts = async () => {
    try {
        const data = await apiGetPublishedBlogPosts();
        return extractRows(data).map(normalizeBlogPost).filter(Boolean);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách blog posts từ Service:', error);
        throw error;
    }
};

// Service lấy chi tiết bài viết theo Slug
export const fetchBlogPostDetail = async (slug) => {
    try {
        const data = await apiGetBlogPostBySlug(slug);
        return normalizeBlogPost(data);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết blog post với slug: ${slug}`, error);
        throw error;
    }
};

// Service: Tải danh sách blog để quản lý (params.status optional: Draft | Published)
export const fetchBlogPostsManagement = async (params = {}) => {
    try {
        const data = await apiGetBlogPostsManagement(params);
        return extractRows(data).map(normalizeBlogPost).filter(Boolean);
    } catch (error) {
        console.error('Lỗi khi lấy danh sách blog quản lý từ Service:', error);
        throw error;
    }
};

// Service: Lấy chi tiết bài viết để quản lý theo id
export const fetchBlogPostManagementDetail = async (id) => {
    try {
        const data = await apiGetBlogPostManagementById(id);
        return normalizeBlogPost(data);
    } catch (error) {
        console.error(`Lỗi khi lấy chi tiết blog quản lý ${id}:`, error);
        throw error;
    }
};

// Service: Tạo bài viết blog mới
export const addBlogPost = async (payload) => {
    try {
        return await apiCreateBlogPost(payload);
    } catch (error) {
        console.error('Lỗi khi tạo blog:', error);
        throw error;
    }
};

// Service: Cập nhật bài viết blog
export const modifyBlogPost = async (id, payload) => {
    try {
        return await apiUpdateBlogPost(id, payload);
    } catch (error) {
        console.error(`Lỗi khi cập nhật blog ${id}:`, error);
        throw error;
    }
};

/**
 * JSON create/update — KHÔNG gửi imageUrl/imageUrls (BE mới: chỉ nhận upload file).
 * Không gửi file → BE giữ ảnh hiện có.
 */
export const buildBlogJsonPayload = ({
    title,
    summary = "",
    content = "",
    category,
    status,
    imageAltText = "",
} = {}) => ({
    title: String(title || "").trim(),
    summary: String(summary || "").trim(),
    content: String(content || "").trim(),
    category: normalizeBlogCategory(category),
    status: String(status || BLOG_STATUS.DRAFT),
    imageAltText: String(imageAltText || "").trim() || null,
});

/**
 * Multipart khi có file ảnh mới.
 * Field: `image` / `images` / `file` (BE chấp nhận cả ba). Không set Content-Type tay.
 */
export const buildBlogMultipartPayload = ({
    title,
    summary = "",
    content = "",
    category,
    status,
    imageAltText = "",
    imageFiles = [],
} = {}) => {
    const formData = new FormData();
    formData.append("title", String(title || "").trim());
    formData.append("summary", String(summary || "").trim());
    formData.append("content", String(content || "").trim());
    formData.append("category", normalizeBlogCategory(category));
    formData.append("status", String(status || BLOG_STATUS.DRAFT));
    formData.append("imageAltText", String(imageAltText || "").trim());

    const files = Array.isArray(imageFiles) ? imageFiles.filter(Boolean) : [];
    // BE chấp nhận field image | images | files — chỉ append 1 lần / file.
    files.forEach((file) => formData.append("images", file));

    return formData;
};

/** Có file → multipart; không → JSON (không kèm imageUrl). */
export const buildBlogWritePayload = ({
    title,
    summary,
    content,
    category,
    status,
    imageAltText,
    imageFiles = [],
} = {}) => {
    const files = Array.isArray(imageFiles) ? imageFiles.filter(Boolean) : [];
    if (files.length > 0) {
        return buildBlogMultipartPayload({
            title,
            summary,
            content,
            category,
            status,
            imageAltText,
            imageFiles: files,
        });
    }
    return buildBlogJsonPayload({
        title,
        summary,
        content,
        category,
        status,
        imageAltText,
    });
};

/** Xóa thật bài viết (DELETE). */
export const removeBlogPost = async (id) => {
    try {
        return await apiDeleteBlogPost(id);
    } catch (error) {
        console.error(`Lỗi khi xóa blog ${id}:`, error);
        throw error;
    }
};

/** Đổi trạng thái nhanh: Draft | Published. */
export const setBlogPostStatus = async (id, status) => {
    try {
        return await apiUpdateBlogPostStatus(id, status);
    } catch (error) {
        console.error(`Lỗi khi đổi status blog ${id}:`, error);
        throw error;
    }
};

/** Xuất bản bài viết (PATCH status = Published). */
export const publishBlogPostById = async (id) => setBlogPostStatus(id, BLOG_STATUS.PUBLISHED);

/** Hạ xuống nháp (PATCH status = Draft). */
export const unpublishBlogPostById = async (id) => setBlogPostStatus(id, BLOG_STATUS.DRAFT);
