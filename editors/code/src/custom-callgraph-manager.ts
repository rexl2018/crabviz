import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 表示自定义调用图中的一个项目
 */
export interface CustomCallGraphItem {
  /** 项目类型：文件或函数 */
  type: 'file' | 'function';
  /** 项目的URI */
  uri: vscode.Uri;
  /** 函数的位置（仅函数类型需要） */
  position?: vscode.Position;
  /** 显示名称 */
  name: string;
}

/**
 * 管理自定义调用图项目的单例类
 */
export class CustomCallGraphManager {
  private static instance: CustomCallGraphManager;
  private items: CustomCallGraphItem[] = [];
  
  private constructor() {}
  
  /**
   * 获取CustomCallGraphManager的单例实例
   */
  public static getInstance(): CustomCallGraphManager {
    if (!CustomCallGraphManager.instance) {
      CustomCallGraphManager.instance = new CustomCallGraphManager();
    }
    return CustomCallGraphManager.instance;
  }
  
  /**
   * 添加项目到自定义调用图
   * @param item 要添加的项目
   * @returns 是否成功添加（如果已存在相同项目则返回false）
   */
  public addItem(item: CustomCallGraphItem): boolean {
    // 检查是否已存在相同项目
    const exists = this.items.some(i => 
      i.type === item.type && 
      i.uri.toString() === item.uri.toString() && 
      (i.type === 'file' || (i.position?.line === item.position?.line && 
                            i.position?.character === item.position?.character))
    );
    
    if (!exists) {
      this.items.push(item);
      return true;
    }
    
    return false;
  }
  
  /**
   * 获取所有已添加的项目
   */
  public getItems(): CustomCallGraphItem[] {
    return [...this.items];
  }
  
  /**
   * 根据索引删除项目
   * @param index 要删除的项目索引
   */
  public removeItem(index: number): boolean {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * 清空所有项目
   */
  public clear(): void {
    this.items = [];
  }
  
  /**
   * 获取项目数量
   */
  public getItemCount(): number {
    return this.items.length;
  }
  
  /**
   * 获取文件类型的项目
   */
  public getFileItems(): CustomCallGraphItem[] {
    return this.items.filter(item => item.type === 'file');
  }
  
  /**
   * 获取函数类型的项目
   */
  public getFunctionItems(): CustomCallGraphItem[] {
    return this.items.filter(item => item.type === 'function');
  }
}