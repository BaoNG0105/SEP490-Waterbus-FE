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

/**
 * FormData: KHÔNG set Content-Type tay — browser/axios phải tự gắn boundary.
 * Set "multipart/form-data" không boundary → BE ASP.NET trả 415.
 */
const formDataRequestConfig = {
    transformRequest: [
        (data, headers) => {
            if (typeof FormData !== 'undefined' && data instanceof FormData && headers) {
                if (typeof headers.delete === 'function') {
                    headers.delete('Content-Type');
                    headers.delete('content-type');
                } else {
                    delete headers['Content-Type'];
                    delete headers['content-type'];
                }
            }
            return data;
        },
    ],
};

// Admin: tạo / cập nhật — JSON object hoặc multipart FormData (field ảnh: `image`)
export const createBlogPost = (payload) => {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return api
        .post('/blog-posts', payload, isFormData ? formDataRequestConfig : undefined)
        .then((response) => response.data);
};

export const updateBlogPost = (id, payload) => {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return api
        .put(`/blog-posts/${id}`, payload, isFormData ? formDataRequestConfig : undefined)
        .then((response) => response.data);
};

/** PATCH /api/blog-posts/{id}/status — đổi nhanh Draft | Published */
export const updateBlogPostStatus = (id, status) =>
    api.patch(`/blog-posts/${id}/status`, { status }).then((response) => response.data);

// Admin: chỉ đổi ảnh (multipart, field `image`)
export const updateBlogPostImage = (id, formData) =>
    api.patch(`/blog-posts/${id}/image`, formData, formDataRequestConfig).then((response) => response.data);

/** @deprecated Dùng updateBlogPostStatus(id, 'Published') */
export const publishBlogPost = (id) =>
    api.post(`/blog-posts/${id}/publish`).then(response => response.data);

/** DELETE — xóa thật record (không soft-delete / Archived). */
export const deleteBlogPost = (id) =>
    api.delete(`/blog-posts/${id}`).then(response => response.data);
