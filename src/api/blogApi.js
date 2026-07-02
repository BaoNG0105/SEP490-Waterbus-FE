import api from './axios';

// API lấy danh sách bài viết blog đã xuất bản
export const getPublishedBlogPosts = () =>
    api.get('/blog-posts').then(response => response.data);

// API lấy chi tiết bài viết cụ thể qua trường Slug phân tuyến URL
export const getBlogPostBySlug = (slug) =>
    api.get(`/blog-posts/${slug}`).then(response => response.data);