import api from './axios';

// Public: chỉ bài Published
export const getPublishedBlogPosts = () =>
    api.get('/blog-posts').then(response => response.data);

export const getBlogPostBySlug = (slug) =>
    api.get(`/blog-posts/${slug}`).then(response => response.data);

// Admin management (Manager/Staff → 403)
// params.status (optional): Draft | Published
export const getBlogPostsManagement = (params = {}) =>
    api.get('/blog-posts/management', { params }).then(response => response.data);

export const getBlogPostManagementById = (id) =>
    api.get(`/blog-posts/management/${id}`).then(response => response.data);

// Admin: tạo / cập nhật (JSON hoặc multipart FormData khi có ảnh)
export const createBlogPost = (payload) =>
    api.post('/blog-posts', payload).then(response => response.data);

export const updateBlogPost = (id, payload) =>
    api.put(`/blog-posts/${id}`, payload).then(response => response.data);

/** PATCH /api/blog-posts/{id}/status — đổi nhanh Draft | Published */
export const updateBlogPostStatus = (id, status) =>
    api.patch(`/blog-posts/${id}/status`, { status }).then((response) => response.data);

// Admin: chỉ đổi ảnh (multipart)
export const updateBlogPostImage = (id, formData) =>
    api.patch(`/blog-posts/${id}/image`, formData).then(response => response.data);

/** @deprecated Dùng updateBlogPostStatus(id, 'Published') */
export const publishBlogPost = (id) =>
    api.post(`/blog-posts/${id}/publish`).then(response => response.data);

/** DELETE — xóa thật record (không soft-delete / Archived). */
export const deleteBlogPost = (id) =>
    api.delete(`/blog-posts/${id}`).then(response => response.data);
