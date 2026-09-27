import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from './environment';
import { CareerEdge, CareerNode } from './models/career.model';

export interface AdminPathHop {
  nodeId: string;
  via: string;
  notes: string;
}

export interface AdminPathSaveResult {
  upserted: number;
  removed: number;
  spine: string;
  edges: CareerEdge[];
}

export interface AdminStoreProductSales {
  productId: string;
  title: string;
  booksPurchased: number;
  amountPaise: number;
  amountLabel: string;
}

export interface AdminStoreOrderRow {
  id: string;
  productId: string;
  productTitle: string;
  amountPaise: number;
  amountLabel: string;
  currency: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  paidAtUtc: string;
  paymentId: string;
}

export interface AdminStoreBuyerPurchase {
  orderId: string;
  productId: string;
  title: string;
  count: number;
  amountPaise: number;
  amountLabel: string;
  paidAtUtc: string;
}

export interface AdminStoreBuyerRow {
  id: string;
  name: string;
  email: string;
  mobile: string;
  createdAtUtc: string;
  isAdmin: boolean;
  booksPurchased: number;
  amountPaise: number;
  amountLabel: string;
  purchases: AdminStoreBuyerPurchase[];
}

export interface AdminEbookCover {
  productId: string;
  title: string;
  kind: string;
  cover: string;
  hasUploadedCover: boolean;
  coverVersion: number;
}

export interface AdminCatalogSuggestion {
  id: number;
  slot: string;
  kind: string;
  title: string;
  notes: string;
  fromId: string;
  fromTitle: string;
  createdAtUtc: string;
}

export interface AdminStoreSales {
  buyerCount: number;
  booksPurchased: number;
  amountReceivedPaise: number;
  amountReceivedLabel: string;
  currency: string;
  booksToday: number;
  amountTodayPaise: number;
  amountTodayLabel: string;
  products: AdminStoreProductSales[];
  buyers: AdminStoreBuyerRow[];
  recent: AdminStoreOrderRow[];
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  listNodes() {
    return this.http.get<CareerNode[]>(`${this.base}/admin/nodes`);
  }

  saveNode(node: CareerNode, isNew: boolean) {
    return isNew
      ? this.http.post<CareerNode>(`${this.base}/admin/nodes`, node)
      : this.http.put<CareerNode>(`${this.base}/admin/nodes/${node.id}`, node);
  }

  deleteNode(id: string) {
    return this.http.delete(`${this.base}/admin/nodes/${id}`);
  }

  listEdges() {
    return this.http.get<CareerEdge[]>(`${this.base}/admin/edges`);
  }

  createEdge(edge: CareerEdge) {
    return this.http.post<CareerEdge>(`${this.base}/admin/edges`, edge);
  }

  updateEdge(edge: CareerEdge) {
    return this.http.put<CareerEdge>(`${this.base}/admin/edges/${edge.id}`, edge);
  }

  deleteEdge(id: number) {
    return this.http.delete(`${this.base}/admin/edges/${id}`);
  }

  storeSales() {
    return this.http.get<AdminStoreSales>(`${this.base}/admin/store/sales`);
  }

  updateStoreBuyer(id: string, body: { name: string; email?: string; mobile?: string }) {
    return this.http.put<AdminStoreSales>(`${this.base}/admin/store/buyers/${encodeURIComponent(id)}`, body);
  }

  setStoreBuyerPassword(id: string, password: string) {
    return this.http.post<{ ok: boolean }>(`${this.base}/admin/store/buyers/${encodeURIComponent(id)}/password`, {
      password,
    });
  }

  deleteStoreBuyer(id: string) {
    return this.http.delete<AdminStoreSales>(`${this.base}/admin/store/buyers/${encodeURIComponent(id)}`);
  }

  deleteStoreOrder(id: string) {
    return this.http.delete<AdminStoreSales>(`${this.base}/admin/store/orders/${encodeURIComponent(id)}`);
  }

  clearStoreSales() {
    return this.http.delete<{ removed: number }>(`${this.base}/admin/store/sales`);
  }

  storeEbooks() {
    return this.http.get<AdminEbookCover[]>(`${this.base}/admin/store/ebooks`);
  }

  uploadEbookCover(productId: string, file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.http.post<AdminEbookCover>(`${this.base}/admin/store/ebooks/${encodeURIComponent(productId)}/cover`, body);
  }

  savePath(steps: AdminPathHop[], previousNodeIds: string[] | null, removeDroppedHops: boolean) {
    return this.http.post<AdminPathSaveResult>(`${this.base}/admin/paths`, {
      steps,
      previousNodeIds,
      removeDroppedHops,
    });
  }

  listSuggestions() {
    return this.http.get<AdminCatalogSuggestion[]>(`${this.base}/admin/suggestions`);
  }

  deleteSuggestion(id: number) {
    return this.http.delete(`${this.base}/admin/suggestions/${id}`);
  }
}
