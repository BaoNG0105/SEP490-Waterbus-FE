import api from './axios';

// API lấy danh sách bài viết blog đã xuất bản
export const getPublishedBlogPosts = () =>
    api.get('/blog-posts').then(response => response.data);

// API lấy chi tiết bài viết cụ thể qua trường Slug phân tuyến URL
export const getBlogPostBySlug = (slug) =>
    api.get(`/blog-posts/${slug}`).then(response => response.data);

// API: Lấy danh sách blog để quản lý (Admin, Manager, Staff)
// params.status (optional): Draft | Published | Archived. Không truyền sẽ trả về tất cả.
export const getBlogPostsManagement = (params = {}) =>
    api.get('/blog-posts/management', { params }).then(response => response.data);

// API: Lấy chi tiết bài viết để quản lý (trả về đủ content kể cả bài Draft/Archived)
export const getBlogPostManagementById = (id) =>
    api.get(`/blog-posts/management/${id}`).then(response => response.data);

// API: Tạo bài viết blog mới
export const createBlogPost = (payload) =>
    api.post('/blog-posts', payload).then(response => response.data);

// API: Cập nhật bài viết blog
export const updateBlogPost = (id, payload) =>
    api.put(`/blog-posts/${id}`, payload).then(response => response.data);

// API: Lưu trữ bài viết (soft delete, đặt Status = Archived)
export const deleteBlogPost = (id) =>
    api.delete(`/blog-posts/${id}`).then(response => response.data);

// API: Xuất bản bài viết (đặt Status = Published, set PublishedAt nếu chưa có)
export const publishBlogPost = (id) =>
    api.post(`/blog-posts/${id}/publish`).then(response => response.data);