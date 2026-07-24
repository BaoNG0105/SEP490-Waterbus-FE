import {
    getPublishedBlogPosts as apiGetPublishedBlogPosts,
    getBlogPostBySlug as apiGetBlogPostBySlug,
    getBlogPostsManagement as apiGetBlogPostsManagement,
    getBlogPostManagementById as apiGetBlogPostManagementById,
    createBlogPost as apiCreateBlogPost,
    updateBlogPost as apiUpdateBlogPost,
    deleteBlogPost as apiDeleteBlogPost,
    publishBlogPost as apiPublishBlogPost,
} from '../api/blogApi';

export const BLOG_STATUS = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
};

export const BLOG_CATEGORY = {
    ACTIVITY: 'Activity',
    EVENT: 'Event',
    NEWS: 'News',
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
    if (item.contentText != null && String(item.contentText).length) return String(item.contentText);
    if (item.content != null && String(item.content).length) return String(item.content);
    if (item.contentHtml) {
        return String(item.contentHtml)
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .trim();
    }
    return "";
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
    return {
        ...item,
        id: String(item.blogPostId ?? item.id ?? ''),
        title: item.title || '',
        slug: item.slug || '',
        summary: item.summary || '',
        category: item.category || BLOG_CATEGORY.NEWS,
        imageUrls,
        imageUrl: imageUrls[0] || '',
        imageAltText: item.imageAltText || '',
        content: contentText,
        contentText,
        contentHtml: item.contentHtml || (item.content && String(item.content).includes("<") ? item.content : "") || "",
        status: item.status || BLOG_STATUS.DRAFT,
        authorName: item.authorName || '',
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

// Service: Tải danh sách blog để quản lý (params.status optional: Draft | Published | Archived)
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

// Service: Lưu trữ bài viết (soft delete, đặt Status = Archived)
export const removeBlogPost = async (id) => {
    try {
        return await apiDeleteBlogPost(id);
    } catch (error) {
        console.error(`Lỗi khi lưu trữ blog ${id}:`, error);
        throw error;
    }
};

// Service: Xuất bản bài viết (đặt Status = Published)
export const publishBlogPostById = async (id) => {
    try {
        return await apiPublishBlogPost(id);
    } catch (error) {
        console.error(`Lỗi khi xuất bản blog ${id}:`, error);
        throw error;
    }
};
