# 📅 **Day 6: Bloom Filters - Efficient Lookups**  

## **🔹 What is a Bloom Filter?**  
A **Bloom Filter** is a **probabilistic data structure** used for **efficient membership testing**. It helps determine if an item is **possibly in a set** or **definitely not in a set**.  

**⚠ Key Property:**  
- **False Positives Possible:** A Bloom filter can incorrectly say an item exists.  
- **False Negatives Impossible:** If an item is NOT in the filter, it is 100% **not in the dataset**.  

🚀 **Why Use Bloom Filters?**  
✅ **Memory Efficient**: Requires less space than storing actual items.  
✅ **Super Fast**: Lookup time is constant **O(k)** (where k = number of hash functions).  
✅ **Scales Well**: Works efficiently with large datasets.  

---

## **🔹 How Does a Bloom Filter Work?**
A Bloom filter uses a **bit array** and **multiple hash functions** to store data.  

### **1️⃣ Insertion Process**  
1. Compute multiple **hashes** for the input.  
2. Set the corresponding bit positions in the **bit array** to **1**.  

### **2️⃣ Lookup Process**  
1. Compute the **same hash functions** for the query item.  
2. Check the bit positions in the bit array:  
   - **All bits are 1** → Item **may exist** (possible false positive).  
   - **Any bit is 0** → Item **definitely does not exist**.  

---

## **🔹 Bloom Filter in Action**
### **Example: Adding "apple" and "banana" to a Bloom Filter**

| Bit Array | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
|-----------|---|---|---|---|---|---|---|---|
| **Insert "apple"** → Hashes to (1, 3, 5) | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 |
| **Insert "banana"** → Hashes to (2, 5, 7) | 0 | 1 | 1 | 1 | 0 | 1 | 0 | 1 |

**Checking if "apple" exists?**  
- Compute hashes → (1, 3, 5).  
- Bits at positions **1, 3, and 5** are **all 1**.  
- ✅ "apple" **may exist**.  

**Checking if "grape" exists?**  
- Compute hashes → (0, 4, 6).  
- **Bit at position 4 is 0** → ❌ "grape" **definitely does not exist**.  

---

## **🔹 Real-World Use Cases**
🔹 **Database Caching** → Avoid unnecessary DB lookups (e.g., **Google BigTable**).  
🔹 **Spell Checking** → Quickly check if a word is likely in the dictionary.  
🔹 **Duplicate Detection** → Prevent duplicate registrations (e.g., emails).  
🔹 **Blockchain & Cryptography** → Used in **Bitcoin P2P networking** to filter transactions.  

---

## **🔍 Hands-On: Implement a Bloom Filter in JavaScript**
Let's build a simple **Bloom Filter** in JavaScript with **3 hash functions**.

### **Step 1️⃣ - Define Hash Functions**
We use simple **hash functions** to compute positions in the bit array.

```js
function hash1(value, size) {
    let hash = 0;
    for (let char of value) {
        hash = (hash + char.charCodeAt(0)) % size;
    }
    return hash;
}

function hash2(value, size) {
    let hash = 0;
    for (let char of value) {
        hash = (hash * 31 + char.charCodeAt(0)) % size;
    }
    return hash;
}

function hash3(value, size) {
    let hash = 7;
    for (let char of value) {
        hash = (hash * 17 + char.charCodeAt(0)) % size;
    }
    return hash;
}
```

---

### **Step 2️⃣ - Implement Bloom Filter Class**
We define a **bit array** and functions to **add and check elements**.

```js
class BloomFilter {
    constructor(size = 20) {
        this.size = size;
        this.bitArray = new Array(size).fill(0);
    }

    add(value) {
        let pos1 = hash1(value, this.size);
        let pos2 = hash2(value, this.size);
        let pos3 = hash3(value, this.size);

        this.bitArray[pos1] = 1;
        this.bitArray[pos2] = 1;
        this.bitArray[pos3] = 1;
    }

    contains(value) {
        let pos1 = hash1(value, this.size);
        let pos2 = hash2(value, this.size);
        let pos3 = hash3(value, this.size);

        return this.bitArray[pos1] && this.bitArray[pos2] && this.bitArray[pos3];
    }
}
```

---

### **Step 3️⃣ - Test the Bloom Filter**
```js
const bloom = new BloomFilter();

bloom.add("apple");
bloom.add("banana");

console.log(bloom.contains("apple"));  // ✅ true (may exist)
console.log(bloom.contains("banana")); // ✅ true (may exist)
console.log(bloom.contains("grape"));  // ❌ false (definitely does not exist)
```

---

## **🔹 Performance & Optimization**
| **Factor** | **Impact** |
|------------|------------|
| **Bit Array Size** | Larger array reduces false positives. |
| **Number of Hash Functions** | More functions reduce false positives but increase computation cost. |
| **Load Factor** | Too many elements increase false positives. |

### **Optimized Parameters**
For best results, use **optimal bit array size (m) and hash functions (k):**
- `m = (n * ln p) / ln(2)^2`
- `k = (m/n) * ln(2)`

Where:  
- `n` = expected number of elements  
- `p` = desired false positive rate  

---

## **🚀 Summary**
| Feature | Bloom Filter |
|---------|-------------|
| **Storage** | Uses a **bit array** |
| **Speed** | Constant time **O(k)** for inserts and lookups |
| **False Positives?** | **Yes** (but controllable with size & hashes) |
| **False Negatives?** | **No** (if it says "no", it's a definite NO) |
| **Use Cases** | Caching, Spell Checkers, Duplicate Detection, Security |

---

## **📌 Next Steps**
🔹 Experiment with **different hash functions** (e.g., MurmurHash).  
🔹 Implement **Bloom Filters in Python, Java, or C++**.  
🔹 Try **Counting Bloom Filters** (supports deletions).  

Would you like me to cover **Counting Bloom Filters** next? 🚀